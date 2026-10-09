package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestMediaBackedAppearanceRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pane.yaml")
	s, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	media, err := openMediaStore(path)
	if err != nil {
		t.Fatal(err)
	}
	h := handler(s, nil, media)
	png := testPNG(t, 4, 4)
	r := httptest.NewRequest("POST", "/api/media/upload", bytes.NewReader(png))
	r.Header.Set("Content-Type", "image/png")
	r.Header.Set("X-Pane-Filename", "wall.png")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var staged StagingInfo
	if err := json.Unmarshal(w.Body.Bytes(), &staged); err != nil {
		t.Fatal(err)
	}
	meta, err := media.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	ref := MediaRef{Source: "asset", AssetID: meta.ID}
	c := s.config
	c.Dashboard.Branding = "logo"
	c.Dashboard.Logo = "/media/assets/" + meta.ID
	bg := defaultBackground()
	bg.Wallpaper = Wallpaper{Kind: "image", Media: &ref, Position: "center"}
	bg.Library = []MediaRef{ref}
	bg.ThemeOverlayOpacity = 35
	c.Appearance.Background = &bg
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
	if err != nil || !reflect.DeepEqual(restart.config.Appearance.Background, c.Appearance.Background) {
		t.Fatal("appearance lost on restart", err)
	}
	backup, _ := yaml.Marshal(c)
	restored, err := decodeYAML(backup)
	if err != nil || !reflect.DeepEqual(restored.Appearance.Background, c.Appearance.Background) {
		t.Fatal("background lost in YAML round trip", err)
	}
}

func TestLogoRejectsDataURI(t *testing.T) {
	if validLogo("data:image/png;base64,aaaa") {
		t.Fatal("data URI logo accepted")
	}
	if !validLogo("") || !validLogo("https://example.com/logo.png") {
		t.Fatal("valid logos rejected")
	}
	if !validLogo("/media/assets/abcdef0123456789abcdef0123456789") {
		t.Fatal("asset path rejected")
	}
}

func TestGlobalAppearanceValidation(t *testing.T) {
	for _, mutate := range []func(*Config){
		func(c *Config) { c.Dashboard.Branding = "anything" },
		func(c *Config) { c.Dashboard.BuiltinIcon = "anything" },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: -1, Blur: 12} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 70, Blur: 25} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Displacement: 151} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Saturation: 201} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Aberration: 101} },
		func(c *Config) {
			bg := defaultBackground()
			bg.Wallpaper = Wallpaper{Kind: "image", Position: "center"}
			c.Appearance.Background = &bg
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

func TestLegacyGlassUnits(t *testing.T) {
	c := defaultConfig()
	c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 0, Blur: 2, Displacement: 150, Saturation: 157, Aberration: 3}
	if err := validate(c); err != nil {
		t.Fatal(err)
	}
	if c.Appearance.Glass.Displacement != 100 || c.Appearance.Glass.Saturation != 79 {
		t.Fatalf("%+v", c.Appearance.Glass)
	}
}

func TestBackgroundEffectAndTint(t *testing.T) {
	c := defaultConfig()
	bg := defaultBackground()
	bg.Wallpaper = Wallpaper{Kind: "gradient", Preset: "dusk"}
	bg.Effect = &Effect{ID: "snow", Params: map[string]any{"speed": 40}}
	bg.Tint = &CreativeTint{Colour: "#ff8800", Opacity: 20}
	bg.ThemeOverlayOpacity = 10
	c.Appearance.Background = &bg
	if err := validate(c); err != nil {
		t.Fatal(err)
	}
	bg.Effect.ID = "aurora"
	c.Appearance.Background = &bg
	if validate(c) == nil {
		t.Fatal("full-scene effect id accepted")
	}
	_ = os.DevNull
}
