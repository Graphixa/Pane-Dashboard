package config

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func populated() Config {
	c := DefaultConfig()
	c.Apps = []AppDefinition{{
		ID: "plex", Name: "Plex", URL: "https://plex.example.com",
		Icon: "dashboard-icons:plex", OpenInNewTab: true,
	}}
	c.Spaces[0].Items = []Pane{{
		ID: "media", Type: "pane", Title: "Media", Layout: Geometry{W: 4, H: 1},
		Apps: []AppPlacement{{ID: "plc-plex", AppID: "plex", Col: 3, Row: 0}},
	}}
	return c
}

func TestValidation(t *testing.T) {
	for _, tt := range []struct {
		name   string
		mutate func(*Config)
	}{
		{"clipped app", func(c *Config) { c.Spaces[0].Items[0].Layout.W = 3 }},
		{"unsafe URL", func(c *Config) { c.Apps[0].URL = "javascript:alert(1)" }},
		{"overlap", func(c *Config) {
			p := c.Spaces[0].Items[0]
			p.ID = "other"
			p.Apps = []AppPlacement{}
			c.Spaces[0].Items = append(c.Spaces[0].Items, p)
		}},
		{"occupied slot", func(c *Config) {
			a := c.Spaces[0].Items[0].Apps[0]
			a.ID = "other"
			c.Spaces[0].Items[0].Apps = append(c.Spaces[0].Items[0].Apps, a)
		}},
		{"global size", func(c *Config) { c.Appearance.AppSize = "large" }},
		{"schema version", func(c *Config) { c.Version = 2 }},
		{"unsafe logo", func(c *Config) { c.Dashboard.Logo = "javascript:alert(1)" }},
		{"logo credentials", func(c *Config) { c.Dashboard.Logo = "https://user:pass@example.com/logo.png" }},
		{"title too large", func(c *Config) { c.Appearance.PaneTitleSize = 23 }},
		{"title too small", func(c *Config) { c.Appearance.PaneTitleSize = 13 }},
		{"unknown font", func(c *Config) { c.Appearance.FontFamily = "inter" }},
		{"duplicate space name", func(c *Config) {
			c.Spaces = append(c.Spaces, Space{ID: "work", Name: "home", Items: []Pane{}})
		}},
		{"missing default", func(c *Config) { c.DefaultSpaceID = "missing" }},
		{"dangling placement", func(c *Config) { c.Spaces[0].Items[0].Apps[0].AppID = "missing" }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			c := populated()
			tt.mutate(&c)
			if Validate(c) == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
	if e := Validate(populated()); e != nil {
		t.Fatal(e)
	}
}

func TestBrandingPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pane.yaml")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	c := DefaultConfig()
	c.Dashboard.Title = "Akira"
	c.Dashboard.Logo = "https://example.com/logo.png"
	c.Appearance.PaneTitleSize = 20
	if err := Validate(c); err != nil {
		t.Fatal(err)
	}
	if err := s.write(c); err != nil {
		t.Fatal(err)
	}
	reloaded, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	got := reloaded.config.Dashboard
	if got.Title != c.Dashboard.Title || got.Logo != c.Dashboard.Logo ||
		got.Width != c.Dashboard.Width || got.WidthMode != c.Dashboard.WidthMode ||
		reloaded.config.Appearance.PaneTitleSize != c.Appearance.PaneTitleSize {
		t.Fatal("branding lost across restart")
	}
}

func TestStrictDecoding(t *testing.T) {
	b, _ := json.Marshal(DefaultConfig())
	b = bytes.Replace(b, []byte(`"version":4`), []byte(`"version":4,"unknown":true`), 1)
	if _, e := DecodeJSON(b); e == nil {
		t.Fatal("unknown field accepted")
	}
	if _, e := DecodeJSON([]byte(`{"version":1} {}`)); e == nil {
		t.Fatal("multiple documents accepted")
	}
}

func TestAtomicFailureKeepsState(t *testing.T) {
	s, e := Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if e != nil {
		t.Fatal(e)
	}
	old := s.revision
	// Force the atomic write to fail: the parent of the new path is a file.
	s.path = filepath.Join(s.path, "child")
	if _, err := s.SaveWithRevision(old, populated(), nil); err == nil {
		t.Fatal("expected write failure")
	}
	if s.revision != old || len(s.config.Spaces[0].Items) != 0 {
		t.Fatal("failed save changed in-memory config")
	}
}

func TestConvertV3(t *testing.T) {
	v3 := ConfigV3{
		Version: 3,
		Dashboard: Dashboard{
			Title: "Home", WidthMode: "fixed", Width: 960,
		},
		Appearance: Appearance{ShowAppLabels: true, ShowButtonLabels: true, Theme: "dark"},
		Items: []PaneV3{{
			ID: "media", Type: "pane", Title: "Media", Layout: Geometry{W: 4, H: 1},
			Apps: []AppV3{{
				ID: "plex", Name: "Plex", URL: "https://plex.example.com",
				Icon: "dashboard-icons:plex", Col: 3, Row: 0, OpenInNewTab: true,
			}},
		}},
	}
	c, err := ConvertV3(v3)
	if err != nil {
		t.Fatal(err)
	}
	if c.Version != 4 || len(c.Spaces) != 1 || c.Spaces[0].Name != "Home" {
		t.Fatal("expected one Home space")
	}
	if len(c.Apps) != 1 || c.Apps[0].ID != "plex" {
		t.Fatal("definition id should preserve old app id")
	}
	if len(c.Spaces[0].Items[0].Apps) != 1 || c.Spaces[0].Items[0].Apps[0].ID != "plc-plex" {
		t.Fatal("placement id should be deterministic plc-{appId}")
	}
	if c.Spaces[0].Items[0].Apps[0].Col != 3 {
		t.Fatal("coordinates lost")
	}
}

func TestSchema3OpenBacksUpAndConverts(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pane.yaml")
	v3 := `version: 3
dashboard:
  title: Home
  widthMode: fixed
  width: 960
appearance:
  showAppLabels: true
  showButtonLabels: true
  theme: dark
items: []
`
	if err := os.WriteFile(path, []byte(v3), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if s.config.Version != 4 || len(s.config.Spaces) != 1 {
		t.Fatal("expected converted schema 4")
	}
	entries, _ := filepath.Glob(filepath.Join(dir, "pane.yaml.schema3-backup-*"))
	if len(entries) != 1 {
		t.Fatalf("expected one backup, got %d", len(entries))
	}
}
