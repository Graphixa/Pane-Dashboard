package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func testPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewNRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestMediaStagePreservesOriginalBytes(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "pane.yaml")
	media, err := openMediaStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 4, 4)
	wantHash := sha256.Sum256(original)

	info, err := media.StageUpload(bytes.NewReader(original), mediaImageUploadLimit, "wall.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(media.stagingPath(info.SessionID))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, original) {
		t.Fatal("staging re-encoded or altered original bytes")
	}
	if info.Meta.Hash != hex.EncodeToString(wantHash[:]) {
		t.Fatal("hash mismatch", info.Meta.Hash)
	}
	if info.Meta.MIME != "image/png" || info.Meta.Width != 4 || info.Meta.Height != 4 {
		t.Fatalf("meta %#v", info.Meta)
	}
	if info.PreviewURL != "/media/staging/"+info.SessionID {
		t.Fatal(info.PreviewURL)
	}
}

func TestMediaCommitAndServeRange(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "pane.yaml")
	s, err := openStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	media, err := openMediaStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 8, 8)
	info, err := media.StageUpload(bytes.NewReader(original), mediaImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := media.CommitStaging(info.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	h := handler(s, nil, media)

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
	var got MediaMeta
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
	s, err := openStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	before := s.revision
	media, err := openMediaStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	h := handler(s, nil, media)
	body := testPNG(t, 2, 2)
	r := httptest.NewRequest("POST", "/api/media/upload", bytes.NewReader(body))
	r.Header.Set("Content-Type", "image/png")
	r.Header.Set("X-Pane-Filename", "x.png")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var info StagingInfo
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatal(err)
	}
	if info.SessionID == "" || info.Meta.Kind != MediaKindImage {
		t.Fatalf("%+v", info)
	}
	if s.revision != before {
		t.Fatal("upload mutated configuration revision")
	}
	after, _ := os.ReadFile(cfg)
	if !bytes.Contains(after, []byte("version: 3")) {
		t.Fatal("config rewritten unexpectedly")
	}
}

func TestMediaRejectsGIFAndOversize(t *testing.T) {
	media, err := openMediaStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	gif := []byte("GIF89a" + string(make([]byte, 20)))
	if _, err := media.StageUpload(bytes.NewReader(gif), mediaImageUploadLimit, "x.gif", "image/gif"); err == nil {
		t.Fatal("gif accepted")
	}
	huge := bytes.Repeat([]byte{0xff, 0xd8, 0xff, 0xd9}, (mediaImageUploadLimit/4)+8)
	if _, err := media.StageUpload(bytes.NewReader(huge), mediaImageUploadLimit, "x.jpg", "image/jpeg"); err == nil {
		t.Fatal("oversize accepted")
	}
}

func TestMediaCleanupProtectsCommittedAndLiveStaging(t *testing.T) {
	media, err := openMediaStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	a := testPNG(t, 2, 2)
	staged, err := media.StageUpload(bytes.NewReader(a), mediaImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	committed, err := media.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	live, err := media.StageUpload(bytes.NewReader(a), mediaImageUploadLimit, "b.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	expired, err := media.StageUpload(bytes.NewReader(a), mediaImageUploadLimit, "c.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	// Backdate expired staging meta.
	var meta MediaMeta
	if err := readJSONFile(media.stagingMetaPath(expired.SessionID), &meta); err != nil {
		t.Fatal(err)
	}
	meta.CreatedAt = time.Now().UTC().Add(-mediaStagingTTL - time.Hour)
	if err := writeJSONAtomic(media.stagingMetaPath(expired.SessionID), meta); err != nil {
		t.Fatal(err)
	}

	err = media.Cleanup(MediaGCProtect{
		AssetIDs:   map[string]struct{}{committed.ID: {}},
		StagingIDs: map[string]struct{}{live.SessionID: {}},
	}, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(media.assetPath(committed.ID)); err != nil {
		t.Fatal("protected asset deleted")
	}
	if _, err := os.Stat(media.stagingPath(live.SessionID)); err != nil {
		t.Fatal("live staging deleted")
	}
	if _, err := os.Stat(media.stagingPath(expired.SessionID)); !os.IsNotExist(err) {
		t.Fatal("expired staging not cleaned")
	}
}

func TestMediaQuotaRejectsExplicitly(t *testing.T) {
	media, err := openMediaStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	// Fill usage near the limit with a fake file under the media root.
	junk := filepath.Join(media.Root(), "assets", "pad")
	f, err := os.Create(junk)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.Truncate(mediaStorageLimit - 10); err != nil {
		t.Fatal(err)
	}
	f.Close()
	png := testPNG(t, 2, 2)
	_, err = media.StageUpload(bytes.NewReader(png), mediaImageUploadLimit, "x.png", "image/png")
	if err != errMediaFull {
		t.Fatalf("want errMediaFull, got %v", err)
	}
}

func TestImagePosterAndMissingAssetMetadata(t *testing.T) {
	media, err := openMediaStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 1600, 900)
	staged, err := media.StageUpload(bytes.NewReader(original), mediaImageUploadLimit, "wall.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := media.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	registerMediaRoutes(mux, media)
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
	onDisk, err := os.ReadFile(media.assetPath(meta.ID))
	if err != nil || !bytes.Equal(onDisk, original) {
		t.Fatal("thumbnail altered original")
	}
	if err := os.Remove(media.assetPath(meta.ID)); err != nil {
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

func testMinimalWebM(t *testing.T) []byte {
	t.Helper()
	// EBML header only — validateVideoFile accepts magic-matched WebM without a full probe.
	return []byte{0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00}
}

func testJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	var b bytes.Buffer
	if err := jpeg.Encode(&b, image.NewNRGBA(image.Rect(0, 0, w, h)), &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestVideoPosterPutAndServe(t *testing.T) {
	media, err := openMediaStore(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	staged, err := media.StageUpload(bytes.NewReader(testMinimalWebM(t)), mediaVideoUploadLimit, "loop.webm", "video/webm")
	if err != nil {
		t.Fatal(err)
	}
	meta, err := media.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	registerMediaRoutes(mux, media)
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
	imgStaged, err := media.StageUpload(bytes.NewReader(testPNG(t, 8, 8)), mediaImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	imgMeta, err := media.CommitStaging(imgStaged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	bad := httptest.NewRecorder()
	mux.ServeHTTP(bad, httptest.NewRequest("PUT", "/api/media/poster/"+imgMeta.ID, bytes.NewReader(testJPEG(t, 32, 32))))
	if bad.Code != 400 {
		t.Fatalf("want 400 for image poster put, got %d", bad.Code)
	}
}
