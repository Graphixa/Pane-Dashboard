package config

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"testing"
)

func populated() Config {
	c := DefaultConfig()
	c.Items = []Pane{{ID: "media", Type: "pane", Title: "Media", Layout: Geometry{W: 4, H: 1}, Apps: []App{{ID: "plex", Name: "Plex", URL: "https://plex.example.com", Icon: "dashboard-icons:plex", Col: 3, Row: 0, OpenInNewTab: true}}}}
	return c
}

func TestValidation(t *testing.T) {
	for _, tt := range []struct {
		name   string
		mutate func(*Config)
	}{
		{"clipped app", func(c *Config) { c.Items[0].Layout.W = 3 }},
		{"unsafe URL", func(c *Config) { c.Items[0].Apps[0].URL = "javascript:alert(1)" }},
		{"overlap", func(c *Config) { p := c.Items[0]; p.ID = "other"; p.Apps = []App{}; c.Items = append(c.Items, p) }},
		{"occupied slot", func(c *Config) { a := c.Items[0].Apps[0]; a.ID = "other"; c.Items[0].Apps = append(c.Items[0].Apps, a) }},
		{"global size", func(c *Config) { c.Appearance.AppSize = "large" }},
		{"schema version", func(c *Config) { c.Version = 2 }},
		{"unsafe logo", func(c *Config) { c.Dashboard.Logo = "javascript:alert(1)" }},
		{"logo credentials", func(c *Config) { c.Dashboard.Logo = "https://user:pass@example.com/logo.png" }},
		{"title too large", func(c *Config) { c.Appearance.PaneTitleSize = 23 }},
		{"title too small", func(c *Config) { c.Appearance.PaneTitleSize = 13 }},
		{"unknown font", func(c *Config) { c.Appearance.FontFamily = "inter" }},
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
	if reloaded.config.Dashboard != c.Dashboard || reloaded.config.Appearance != c.Appearance {
		t.Fatal("branding lost across restart")
	}
}

func TestStrictDecoding(t *testing.T) {
	b, _ := json.Marshal(DefaultConfig())
	b = bytes.Replace(b, []byte(`"version":3`), []byte(`"version":3,"unknown":true`), 1)
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
	if s.revision != old || len(s.config.Items) != 0 {
		t.Fatal("failed save changed in-memory config")
	}
}
