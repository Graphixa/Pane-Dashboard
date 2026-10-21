package config

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestOldSchemaRejectedOnLoad(t *testing.T) {
	p := filepath.Join(t.TempDir(), "pane.yaml")
	legacy := populated()
	legacy.Version = 2
	b, _ := yaml.Marshal(legacy)
	if err := os.WriteFile(p, b, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(p); err == nil {
		t.Fatal("schema 2 accepted")
	}
	after, _ := os.ReadFile(p)
	if !bytes.Equal(b, after) {
		t.Fatal("old file was rewritten")
	}
}

func TestTileGutterValidation(t *testing.T) {
	c := populated()
	p := c.Spaces[0].Items[0]
	p.ID = "other"
	p.Apps = []AppPlacement{}
	p.Layout.X = 60
	c.Spaces[0].Items = append(c.Spaces[0].Items, p)
	if e := Validate(c); e != nil {
		t.Fatal(e)
	}
	c.Spaces[0].Items[1].Layout.X = 59
	if Validate(c) == nil {
		t.Fatal("gutter overlap accepted")
	}
	c.Spaces[0].Items[1].Layout.X = 60
	c.Dashboard.Width = 952
	if Validate(c) == nil {
		t.Fatal("workspace overflow accepted")
	}
}

func TestSameCoordsDifferentSpaces(t *testing.T) {
	c := populated()
	c.Spaces = append(c.Spaces, Space{
		ID: "work", Name: "Work",
		Items: []Pane{{
			ID: "media2", Type: "pane", Title: "Media", Layout: Geometry{W: 4, H: 1},
			Apps: []AppPlacement{{ID: "plc-plex-2", AppID: "plex", Col: 3, Row: 0}},
		}},
	})
	if err := Validate(c); err != nil {
		t.Fatal(err)
	}
}
