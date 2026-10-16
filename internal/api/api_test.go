package api

import (
	"bytes"
	"encoding/json"
	"image"
	"image/jpeg"
	"image/png"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Graphixa/Pane-Dashboard/internal/config"
)

func testPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewNRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func testJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := jpeg.Encode(&b, image.NewNRGBA(image.Rect(0, 0, w, h)), &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func testMinimalWebM(t *testing.T) []byte {
	t.Helper()
	// EBML header only — validateVideoFile accepts magic-matched WebM without a full probe.
	return []byte{0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00}
}

func populated() config.Config {
	c := config.DefaultConfig()
	c.Items = []config.Pane{{ID: "media", Type: "pane", Title: "Media", Layout: config.Geometry{W: 4, H: 1}, Apps: []config.App{{ID: "plex", Name: "Plex", URL: "https://plex.example.com", Icon: "dashboard-icons:plex", Col: 3, Row: 0, OpenInNewTab: true}}}}
	return c
}

func TestStoreAndConflict(t *testing.T) {
	p := filepath.Join(t.TempDir(), "pane.yaml")
	s, e := config.Open(p)
	if e != nil {
		t.Fatal(e)
	}
	h := Handler(s, nil, nil)
	get := httptest.NewRecorder()
	h.ServeHTTP(get, httptest.NewRequest("GET", "/api/config", nil))
	etag := get.Header().Get("ETag")
	c := populated()
	b, _ := json.Marshal(c)
	put := func(rev string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("PUT", "/api/config", bytes.NewReader(b))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("If-Match", rev)
		h.ServeHTTP(w, r)
		return w
	}
	if w := put(etag); w.Code != 200 {
		t.Fatalf("save: %d %s", w.Code, w.Body.String())
	}
	if w := put(etag); w.Code != 412 {
		t.Fatalf("stale save returned %d", w.Code)
	}
	if w := put(""); w.Code != 428 {
		t.Fatal("missing revision accepted")
	}
	reload, e := config.Open(p)
	if e != nil || len(reload.Get().Items) != 1 {
		t.Fatal("save did not persist", e)
	}
	before, _ := os.ReadFile(p)
	if e := os.WriteFile(p, []byte("invalid: yes\n"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := config.Open(p); e == nil {
		t.Fatal("invalid file accepted")
	}
	after, _ := os.ReadFile(p)
	if bytes.Equal(before, after) || string(after) != "invalid: yes\n" {
		t.Fatal("invalid file replaced")
	}
}

func TestCrossOrigin(t *testing.T) {
	s, _ := config.Open(filepath.Join(t.TempDir(), "pane.yaml"))
	r := httptest.NewRequest("PUT", "http://pane.local/api/config", nil)
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	Handler(s, nil, nil).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("cross-origin mutation accepted")
	}
}

func TestOldSchemaPutRejected(t *testing.T) {
	s, _ := config.Open(filepath.Join(t.TempDir(), "pane.yaml"))
	h := Handler(s, nil, nil)
	legacy := populated()
	legacy.Version = 2
	b, _ := json.Marshal(legacy)
	w := httptest.NewRecorder()
	r := httptest.NewRequest("PUT", "/api/config", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", s.Revision())
	h.ServeHTTP(w, r)
	if w.Code != 400 {
		t.Fatal("old schema save accepted", w.Code, w.Body.String())
	}
}

func TestImportPreviewSchema3Only(t *testing.T) {
	s, _ := config.Open(filepath.Join(t.TempDir(), "pane.yaml"))
	h := Handler(s, nil, nil)
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
