package api

import (
	"bytes"
	"encoding/json"
	"image"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
)

func TestMediaCommitAndServeRange(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "pane.yaml")
	s, err := config.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	store, err := media.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 8, 8)
	info, err := store.StageUpload(bytes.NewReader(original), media.ImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := store.CommitStaging(info.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	h := Handler(s, nil, store)

	req := httptest.NewRequest("GET", "/media/assets/"+meta.ID, nil)
	req.Header.Set("Range", "bytes=0-3")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusPartialContent {
		t.Fatal(w.Code, w.Body.String())
	}
	if w.Header().Get("Content-Type") != "image/png" {
		t.Fatal(w.Header().Get("Content-Type"))
	}
	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing nosniff")
	}
	if !bytes.Equal(w.Body.Bytes(), original[:4]) {
		t.Fatal("range body mismatch")
	}

	head := httptest.NewRequest("HEAD", "/media/assets/"+meta.ID, nil)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, head)
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w.Body.Len() != 0 {
		t.Fatal("HEAD should not write body")
	}

	metaReq := httptest.NewRequest("GET", "/api/media/meta/"+meta.ID, nil)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, metaReq)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var got media.MediaMeta
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != meta.ID || got.Name != "a.png" {
		t.Fatalf("meta %#v", got)
	}
}

func TestMediaUploadEndpointDoesNotTouchConfig(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "pane.yaml")
	s, err := config.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	before := s.Revision()
	store, err := media.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	h := Handler(s, nil, store)
	body := testPNG(t, 2, 2)
	r := httptest.NewRequest("POST", "/api/media/upload", bytes.NewReader(body))
	r.Header.Set("Content-Type", "image/png")
	r.Header.Set("X-Pane-Filename", "x.png")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var info media.StagingInfo
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	if info.SessionID == "" || info.Meta.Kind != media.MediaKindImage {
		t.Fatalf("%+v", info)
	}
	if s.Revision() != before {
		t.Fatal("upload mutated configuration revision")
	}
	after, _ := os.ReadFile(cfg)
	if !bytes.Contains(after, []byte("version: 3")) {
		t.Fatal("config rewritten unexpectedly")
	}
}

func TestImagePosterAndMissingAssetMetadata(t *testing.T) {
	store, err := media.Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 1600, 900)
	staged, err := store.StageUpload(bytes.NewReader(original), media.ImageUploadLimit, "wall.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := store.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	registerMediaRoutes(mux, store)
	request := func(path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest("GET", path, nil))
		return recorder
	}
	poster := request("/media/assets/" + meta.ID + "/poster")
	if poster.Code != 200 || poster.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("poster: %d %s", poster.Code, poster.Body.String())
	}
	dimensions, _, err := image.DecodeConfig(bytes.NewReader(poster.Body.Bytes()))
	if err != nil || dimensions.Width != 480 || dimensions.Height != 270 {
		t.Fatalf("dimensions: %+v %v", dimensions, err)
	}
	cached := request("/media/assets/" + meta.ID + "/poster")
	if !bytes.Equal(poster.Body.Bytes(), cached.Body.Bytes()) {
		t.Fatal("thumbnail was not cached")
	}
	onDisk, err := store.ReadAssetBytes(meta.ID)
	if err != nil || !bytes.Equal(onDisk, original) {
		t.Fatal("thumbnail altered original")
	}
	if err := os.Remove(filepath.Join(store.Root(), "assets", meta.ID)); err != nil {
		t.Fatal(err)
	}
	missing := request("/api/media/meta/" + meta.ID)
	if missing.Code != 404 || missing.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("stale metadata: %d", missing.Code)
	}
	if gone := request("/media/assets/" + meta.ID + "/poster"); gone.Code != 404 {
		t.Fatal("served poster for deleted asset")
	}
}

func TestVideoPosterPutAndServe(t *testing.T) {
	store, err := media.Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	staged, err := store.StageUpload(bytes.NewReader(testMinimalWebM(t)), media.VideoUploadLimit, "loop.webm", "video/webm")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := store.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	registerMediaRoutes(mux, store)
	get := func(path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest("GET", path, nil))
		return recorder
	}
	if missing := get("/media/assets/" + meta.ID + "/poster"); missing.Code != 404 {
		t.Fatalf("video poster before put: %d", missing.Code)
	}
	put := httptest.NewRecorder()
	req := httptest.NewRequest("PUT", "/api/media/poster/"+meta.ID, bytes.NewReader(testJPEG(t, 640, 360)))
	req.Header.Set("Content-Type", "image/jpeg")
	mux.ServeHTTP(put, req)
	if put.Code != http.StatusNoContent {
		t.Fatalf("put poster: %d %s", put.Code, put.Body.String())
	}
	poster := get("/media/assets/" + meta.ID + "/poster")
	if poster.Code != 200 || poster.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("poster: %d %s", poster.Code, poster.Body.String())
	}
	dimensions, _, err := image.DecodeConfig(bytes.NewReader(poster.Body.Bytes()))
	if err != nil || dimensions.Width != 480 || dimensions.Height != 270 {
		t.Fatalf("dimensions: %+v %v", dimensions, err)
	}
	// Image asset cannot accept a video-poster PUT.
	imgStaged, err := store.StageUpload(bytes.NewReader(testPNG(t, 8, 8)), media.ImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	imgMeta, err := store.CommitStaging(imgStaged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	bad := httptest.NewRecorder()
	mux.ServeHTTP(bad, httptest.NewRequest("PUT", "/api/media/poster/"+imgMeta.ID, bytes.NewReader(testJPEG(t, 32, 32))))
	if bad.Code != 400 {
		t.Fatalf("want 400 for image poster put, got %d", bad.Code)
	}
}
