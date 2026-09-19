package main

import (
	"bytes"
	"encoding/json"
	"gopkg.in/yaml.v3"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func legacy() Config {
	c := populated()
	c.Version = 1
	c.Appearance.AppSize = "medium"
	c.Items[0].Layout = Geometry{X: 1, Y: 2, W: 11, H: 10}
	return c
}
func TestMigrationPreservesAppsAndGaps(t *testing.T) {
	c := legacy()
	p := c.Items[0]
	p.ID = "next"
	p.Layout.X = 12
	p.Apps = []App{}
	c.Items = append(c.Items, p)
	n, e := upgrade(c)
	if e != nil {
		t.Fatal(e)
	}
	if n.Version != 2 || n.Appearance.AppSize != "" || n.Items[0].Layout.W != 4 || n.Items[0].Layout.H != 2 {
		t.Fatal(n)
	}
	if !reflect.DeepEqual(n.Items[0].Apps, c.Items[0].Apps) {
		t.Fatal("app positions changed")
	}
	if n.Items[1].Layout.X <= n.Items[0].Layout.X || overlaps(frame(n.Items[0].Layout), frame(n.Items[1].Layout)) {
		t.Fatal("placement lost")
	}
	again, e := upgrade(n)
	if e != nil || !reflect.DeepEqual(n, again) {
		t.Fatal("not idempotent")
	}
}
func TestMigrationBackupAndRestart(t *testing.T) {
	p := filepath.Join(t.TempDir(), "pane.yaml")
	b, _ := yaml.Marshal(legacy())
	if e := os.WriteFile(p, b, 0600); e != nil {
		t.Fatal(e)
	}
	s, e := openStore(p)
	if e != nil {
		t.Fatal(e)
	}
	if s.config.Version != 2 {
		t.Fatal("not upgraded")
	}
	backups, _ := filepath.Glob(p + ".v1-*.bak")
	if len(backups) != 1 {
		t.Fatal(backups)
	}
	backup, _ := os.ReadFile(backups[0])
	if !bytes.Equal(b, backup) {
		t.Fatal("original not preserved")
	}
	if _, e = openStore(p); e != nil {
		t.Fatal(e)
	}
	backups, _ = filepath.Glob(p + ".v1-*.bak")
	if len(backups) != 1 {
		t.Fatal("repeated migration")
	}
}
func TestImportPreviewIsReadOnlyAndOldSavesRejected(t *testing.T) {
	s, _ := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
	h := handler(s, nil)
	b, _ := json.Marshal(legacy())
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/api/import/preview", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var n Config
	if e := json.Unmarshal(w.Body.Bytes(), &n); e != nil || n.Version != 2 {
		t.Fatal("not upgraded", e)
	}
	if len(s.config.Items) != 0 {
		t.Fatal("preview saved data")
	}
	w = httptest.NewRecorder()
	r = httptest.NewRequest("PUT", "/api/config", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", s.revision)
	h.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal("old tab save accepted")
	}
}
func TestTileGutterValidation(t *testing.T) {
	c := populated()
	p := c.Items[0]
	p.ID = "other"
	p.Apps = []App{}
	p.Layout.X = 60
	c.Items = append(c.Items, p)
	if e := validate(c); e != nil {
		t.Fatal(e)
	}
	c.Items[1].Layout.X = 59
	if validate(c) == nil {
		t.Fatal("gutter overlap accepted")
	}
	c.Items[1].Layout.X = 60
	c.Dashboard.Width = 952
	if validate(c) == nil {
		t.Fatal("workspace overflow accepted")
	}
}
func TestInvalidLegacyNotReplaced(t *testing.T) {
	p := filepath.Join(t.TempDir(), "pane.yaml")
	c := legacy()
	c.Items[0].Apps[0].Col = 99
	b, _ := yaml.Marshal(c)
	os.WriteFile(p, b, 0600)
	if _, e := openStore(p); e == nil {
		t.Fatal("invalid migration accepted")
	}
	after, _ := os.ReadFile(p)
	if !bytes.Equal(b, after) {
		t.Fatal("original changed")
	}
}
