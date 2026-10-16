package api

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
)

func TestMediaBackedAppearanceRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pane.yaml")
	s, err := config.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	store, err := media.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	h := Handler(s, nil, store)
	pngBytes := testPNG(t, 4, 4)
	r := httptest.NewRequest("POST", "/api/media/upload", bytes.NewReader(pngBytes))
	r.Header.Set("Content-Type", "image/png")
	r.Header.Set("X-Pane-Filename", "wall.png")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var staged media.StagingInfo
	if err := json.Unmarshal(w.Body.Bytes(), &staged); err != nil {
		t.Fatal(err)
	}
	meta, err := store.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	ref := config.MediaRef{Source: "asset", AssetID: meta.ID}
	c := s.Get()
	c.Dashboard.Branding = "logo"
	c.Dashboard.Logo = "/media/assets/" + meta.ID
	bg := config.DefaultBackground()
	bg.Wallpaper = config.Wallpaper{Kind: "image", Media: &ref, Position: "center"}
	bg.Library = []config.MediaRef{ref}
	bg.ThemeOverlayOpacity = 35
	c.Appearance.Background = &bg
	c.Appearance.Glass = &config.Glass{Mode: "glass", Opacity: 65, Blur: 16}
	c.Appearance.Palette = &config.Palette{Background: "#111720", Surface: "#1a222e", Text: "#e9eef7", Accent: "#a2cbbb"}
	payload, _ := json.Marshal(c)
	r = httptest.NewRequest("PUT", "/api/config", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", s.Revision())
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	restart, err := config.Open(path)
	if err != nil || !reflect.DeepEqual(restart.Get().Appearance.Background, c.Appearance.Background) {
		t.Fatal("appearance lost on restart", err)
	}
	backup, _ := yaml.Marshal(c)
	restored, err := config.DecodeYAML(backup)
	if err != nil || !reflect.DeepEqual(restored.Appearance.Background, c.Appearance.Background) {
		t.Fatal("background lost in YAML round trip", err)
	}
}
