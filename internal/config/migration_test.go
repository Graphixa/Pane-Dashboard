package config

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

// Path A: older schemas are rejected; nothing is migrated.

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
	p := c.Items[0]
	p.ID = "other"
	p.Apps = []App{}
	p.Layout.X = 60
	c.Items = append(c.Items, p)
	if e := Validate(c); e != nil {
		t.Fatal(e)
	}
	c.Items[1].Layout.X = 59
	if Validate(c) == nil {
		t.Fatal("gutter overlap accepted")
	}
	c.Items[1].Layout.X = 60
	c.Dashboard.Width = 952
	if Validate(c) == nil {
		t.Fatal("workspace overflow accepted")
	}
}
