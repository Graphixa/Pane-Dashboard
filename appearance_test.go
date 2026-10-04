package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func samplePNG(t *testing.T) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewNRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func TestPrepareImageIsPortableAndDoesNotPersist(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pane.yaml")
	s, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(path)
	oldRevision := s.revision
	h := handler(s, nil)
	r := httptest.NewRequest("POST", "/api/images/prepare", bytes.NewReader(samplePNG(t)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var result map[string]string
	json.Unmarshal(w.Body.Bytes(), &result)
	if !validImage(result["image"]) {
		t.Fatal("invalid prepared image")
	}
	after, _ := os.ReadFile(path)
	if !bytes.Equal(before, after) || oldRevision != s.revision {
		t.Fatal("preparation persisted a cancelled draft")
	}
	c := s.config
	c.Dashboard.Branding = "logo"
	c.Dashboard.Logo = result["image"]
	c.Appearance.Background = &Background{Kind: "image", Preset: "ocean", Image: result["image"], Overlay: "dark-solid", OverlayOpacity: 35, OverlayColour: "#111720", Position: "center", Motion: false, Intensity: 40}
	c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 65, Blur: 16}
	c.Appearance.Palette = &Palette{Background: "#111720", Surface: "#1a222e", Text: "#e9eef7", Accent: "#a2cbbb"}
	payload, _ := json.Marshal(c)
	r = httptest.NewRequest("PUT", "/api/config", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", s.revision)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	restart, err := openStore(path)
	if err != nil || !reflect.DeepEqual(restart.config, c) {
		t.Fatal("appearance lost on restart", err)
	}
	backup, _ := yaml.Marshal(c)
	restored, err := decodeYAML(backup)
	if err != nil || !reflect.DeepEqual(restored, c) {
		t.Fatal("uploaded assets lost in portable backup", err)
	}
	preview := httptest.NewRequest("POST", "/api/import/preview", bytes.NewReader(payload))
	preview.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, preview)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
func TestImageSafety(t *testing.T) {
	good := samplePNG(t)
	for _, s := range []string{"data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,bm90IGFuIGltYWdl", "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(good), "https://user:pass@example.com/icon.png", "javascript:alert(1)"} {
		if validImage(s) {
			t.Fatalf("accepted unsafe image %q", s)
		}
	}
	var huge bytes.Buffer
	png.Encode(&huge, image.NewGray(image.Rect(0, 0, 4097, 1)))
	for _, tt := range []struct {
		name   string
		data   []byte
		origin string
		status int
	}{
		{"SVG", []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`), "", 400},
		{"bad bytes", []byte("hello"), "", 400},
		{"oversized dimensions", huge.Bytes(), "", 400},
		{"request limit", bytes.Repeat([]byte("x"), (5<<20)+1), "", 413},
		{"cross origin", good, "https://other.example", 403},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s, _ := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
			r := httptest.NewRequest("POST", "http://pane.example/api/images/prepare", bytes.NewReader(tt.data))
			r.Header.Set("Origin", tt.origin)
			w := httptest.NewRecorder()
			handler(s, nil).ServeHTTP(w, r)
			if w.Code != tt.status {
				t.Fatal(w.Code, w.Body.String())
			}
		})
	}
}
func TestGlobalAppearanceValidation(t *testing.T) {
	for _, mutate := range []func(*Config){
		func(c *Config) { c.Dashboard.Branding = "anything" },
		func(c *Config) { c.Dashboard.BuiltinIcon = "anything" },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: -1, Blur: 12} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 70, Blur: 25} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Displacement: 200} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Elasticity: 120} },
		func(c *Config) {
			c.Appearance.Background = &Background{Kind: "image", Preset: "ocean", Position: "center"}
		},
		func(c *Config) {
			c.Appearance.Palette = &Palette{Background: "#111111", Surface: "#111111", Text: "#121212", Accent: "#ff0000"}
		},
		func(c *Config) {
			c.Appearance.Palette = &Palette{Background: "url(test)", Surface: "#111111", Text: "#ffffff", Accent: "#ff0000"}
		},
	} {
		c := defaultConfig()
		mutate(&c)
		if validate(c) == nil {
			t.Fatal("invalid appearance accepted")
		}
	}
	c := populated()
	b, _ := json.Marshal(c)
	b = bytes.Replace(b, []byte(`"type":"pane"`), []byte(`"type":"pane","glass":{"mode":"glass"}`), 1)
	if _, err := decodeJSON(b); err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatal("per-pane appearance override accepted", err)
	}
}
