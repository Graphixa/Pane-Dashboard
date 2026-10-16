package builtin

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestValidBuiltinID(t *testing.T) {
	ok := []string{"forest@v1", "nebula-loop@v2", "a@v10"}
	for _, id := range ok {
		if !validBuiltinID(id) {
			t.Fatalf("expected valid: %s", id)
		}
	}
	bad := []string{"", "forest", "Forest@v1", "../x@v1", "a@v", "a@vx", "a/b@v1", "a\\b@v1"}
	for _, id := range bad {
		if validBuiltinID(id) {
			t.Fatalf("expected invalid: %s", id)
		}
	}
}

func TestServeBuiltinMedia(t *testing.T) {
	idx, err := loadBuiltinIndex()
	if err != nil {
		t.Fatal(err)
	}
	if len(idx) == 0 {
		t.Fatal("expected fixture catalogue items — run npm run catalogue")
	}
	var sample string
	for id := range idx {
		sample = id
		break
	}
	mux := http.NewServeMux()
	RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/media/builtin/"+url.PathEscape(sample), nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Fatalf("Cache-Control %q", got)
	}
	ct := rec.Header().Get("Content-Type")
	if ct != "image/png" && ct != "image/jpeg" && ct != "image/webp" && ct != "video/webm" && ct != "video/mp4" {
		t.Fatalf("content-type %q", ct)
	}
	body, _ := io.ReadAll(rec.Body)
	if len(body) == 0 {
		t.Fatal("empty body")
	}

	missing := httptest.NewRequest("GET", "/media/builtin/nope@v1", nil)
	recM := httptest.NewRecorder()
	mux.ServeHTTP(recM, missing)
	if recM.Code != 404 {
		t.Fatalf("missing status %d", recM.Code)
	}

	bad := httptest.NewRequest("GET", "/media/builtin/../secret", nil)
	recB := httptest.NewRecorder()
	mux.ServeHTTP(recB, bad)
	if recB.Code == 200 {
		t.Fatal("path traversal must not succeed")
	}
}
