package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func populated() Config {
	c := defaultConfig()
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
		{"schema version", func(c *Config) { c.Version = 3 }},
		{"unsafe logo", func(c *Config) { c.Dashboard.Logo = "javascript:alert(1)" }},
		{"logo credentials", func(c *Config) { c.Dashboard.Logo = "https://user:pass@example.com/logo.png" }},
		{"title too large", func(c *Config) { c.Appearance.PaneTitleSize = 23 }},
		{"title too small", func(c *Config) { c.Appearance.PaneTitleSize = 13 }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			c := populated()
			tt.mutate(&c)
			if validate(c) == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
	if e := validate(populated()); e != nil {
		t.Fatal(e)
	}
}
func TestBrandingPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "pane.yaml")
	s, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	c := defaultConfig()
	c.Dashboard.Title = "Akira"
	c.Dashboard.Logo = "https://example.com/logo.png"
	c.Appearance.PaneTitleSize = 20
	if err := validate(c); err != nil {
		t.Fatal(err)
	}
	if err := s.write(c); err != nil {
		t.Fatal(err)
	}
	reloaded, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.config.Dashboard != c.Dashboard || reloaded.config.Appearance != c.Appearance {
		t.Fatal("branding lost across restart")
	}
}
func TestStrictDecoding(t *testing.T) {
	b, _ := json.Marshal(defaultConfig())
	b = bytes.Replace(b, []byte(`"version":2`), []byte(`"version":2,"unknown":true`), 1)
	if _, e := decodeJSON(b); e == nil {
		t.Fatal("unknown field accepted")
	}
	if _, e := decodeJSON([]byte(`{"version":1} {}`)); e == nil {
		t.Fatal("multiple documents accepted")
	}
}
func TestStoreAndConflict(t *testing.T) {
	p := filepath.Join(t.TempDir(), "pane.yaml")
	s, e := openStore(p)
	if e != nil {
		t.Fatal(e)
	}
	h := handler(s, nil)
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
	reload, e := openStore(p)
	if e != nil || len(reload.config.Items) != 1 {
		t.Fatal("save did not persist", e)
	}
	before, _ := os.ReadFile(p)
	if e := os.WriteFile(p, []byte("invalid: yes\n"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := openStore(p); e == nil {
		t.Fatal("invalid file accepted")
	}
	after, _ := os.ReadFile(p)
	if bytes.Equal(before, after) || string(after) != "invalid: yes\n" {
		t.Fatal("invalid file replaced")
	}
}
func TestAtomicFailureKeepsState(t *testing.T) {
	s, e := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if e != nil {
		t.Fatal(e)
	}
	old := s.revision
	s.path = filepath.Join(s.path, "child")
	b, _ := json.Marshal(populated())
	r := httptest.NewRequest("PUT", "/api/config", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("If-Match", old)
	w := httptest.NewRecorder()
	handler(s, nil).ServeHTTP(w, r)
	if w.Code != 500 || s.revision != old || len(s.config.Items) != 0 {
		t.Fatal("failed save changed in-memory config")
	}
}
func TestCrossOrigin(t *testing.T) {
	s, _ := openStore(filepath.Join(t.TempDir(), "pane.yaml"))
	r := httptest.NewRequest("PUT", "http://pane.local/api/config", nil)
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	handler(s, nil).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("cross-origin mutation accepted")
	}
}
func TestDockerSanitisedAndReadOnly(t *testing.T) {
	calls := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/version":
			w.Write([]byte(`{"ApiVersion":"1.45"}`))
		case "/v1.45/containers/json":
			w.Write([]byte(`[{"Id":"volatile","Names":["/media-sonarr-1"],"Image":"linuxserver/sonarr:latest","Labels":{"com.docker.compose.project":"media","com.docker.compose.service":"sonarr","private":"secret"},"Ports":[{"IP":"0.0.0.0","PublicPort":8989,"PrivatePort":8989,"Type":"tcp"}]}]`))
		default:
			t.Error("unexpected Docker endpoint")
		}
	}))
	defer server.Close()
	d, e := newDockerProvider(server.URL)
	if e != nil {
		t.Fatal(e)
	}
	apps, e := d.Scan(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(apps)
	if bytes.Contains(b, []byte("secret")) || bytes.Contains(b, []byte("volatile")) || len(apps) != 1 || apps[0].Name != "sonarr" {
		t.Fatal("bad candidates", string(b))
	}
	if len(calls) != 2 || calls[0] != "GET /version" {
		t.Fatal(calls)
	}
}
