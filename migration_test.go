package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
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
	if _, err := openStore(p); err == nil {
		t.Fatal("schema 2 accepted")
	}
	after, _ := os.ReadFile(p)
	if !bytes.Equal(b, after) {
		t.Fatal("old file was rewritten")
	}
}

func TestOldSchemaPutRejected(t *testing.T) {
	s, _ := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
	h := handler(s, nil, nil)
	legacy := populated()
	legacy.Version = 2
	b, _ := json.Marshal(legacy)
	w := httptest.NewRecorder()
	r := httptest.NewRequest("PUT", "/api/config", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", s.revision)
	h.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal("old schema save accepted", w.Code, w.Body.String())
	}
}

func TestImportPreviewSchema3Only(t *testing.T) {
	s, _ := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
	h := handler(s, nil, nil)
	ok := populated()
	b, _ := json.Marshal(ok)
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/api/import/preview", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	legacy := populated()
	legacy.Version = 1
	b, _ = json.Marshal(legacy)
	w = httptest.NewRecorder()
	r = httptest.NewRequest("POST", "/api/import/preview", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal("schema 1 import preview accepted")
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
