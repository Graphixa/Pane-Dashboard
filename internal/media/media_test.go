package media

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/png"
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
	store, err := Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	original := testPNG(t, 4, 4)
	wantHash := sha256.Sum256(original)

	info, err := store.StageUpload(bytes.NewReader(original), ImageUploadLimit, "wall.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(store.stagingPath(info.SessionID))
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

func TestMediaRejectsGIFAndOversize(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	gif := []byte("GIF89a" + string(make([]byte, 20)))
	if _, err := store.StageUpload(bytes.NewReader(gif), ImageUploadLimit, "x.gif", "image/gif"); err == nil {
		t.Fatal("gif accepted")
	}
	huge := bytes.Repeat([]byte{0xff, 0xd8, 0xff, 0xd9}, (ImageUploadLimit/4)+8)
	if _, err := store.StageUpload(bytes.NewReader(huge), ImageUploadLimit, "x.jpg", "image/jpeg"); err == nil {
		t.Fatal("oversize accepted")
	}
}

func TestMediaCleanupProtectsCommittedAndLiveStaging(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	a := testPNG(t, 2, 2)
	staged, err := store.StageUpload(bytes.NewReader(a), ImageUploadLimit, "a.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	committed, err := store.CommitStaging(staged.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	live, err := store.StageUpload(bytes.NewReader(a), ImageUploadLimit, "b.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	expired, err := store.StageUpload(bytes.NewReader(a), ImageUploadLimit, "c.png", "image/png")
	if err != nil {
		t.Fatal(err)
	}
	// Backdate expired staging meta.
	var meta MediaMeta
	if err := readJSONFile(store.stagingMetaPath(expired.SessionID), &meta); err != nil {
		t.Fatal(err)
	}
	meta.CreatedAt = time.Now().UTC().Add(-mediaStagingTTL - time.Hour)
	if err := writeJSONAtomic(store.stagingMetaPath(expired.SessionID), meta); err != nil {
		t.Fatal(err)
	}

	err = store.Cleanup(MediaGCProtect{
		AssetIDs:   map[string]struct{}{committed.ID: {}},
		StagingIDs: map[string]struct{}{live.SessionID: {}},
	}, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(store.assetPath(committed.ID)); err != nil {
		t.Fatal("protected asset deleted")
	}
	if _, err := os.Stat(store.stagingPath(live.SessionID)); err != nil {
		t.Fatal("live staging deleted")
	}
	if _, err := os.Stat(store.stagingPath(expired.SessionID)); !os.IsNotExist(err) {
		t.Fatal("expired staging not cleaned")
	}
}

func TestMediaQuotaRejectsExplicitly(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "pane.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	// Fill usage near the limit with a fake file under the media root.
	junk := filepath.Join(store.Root(), "assets", "pad")
	f, err := os.Create(junk)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.Truncate(mediaStorageLimit - 10); err != nil {
		t.Fatal(err)
	}
	f.Close()
	png := testPNG(t, 2, 2)
	_, err = store.StageUpload(bytes.NewReader(png), ImageUploadLimit, "x.png", "image/png")
	if err != errMediaFull {
		t.Fatalf("want errMediaFull, got %v", err)
	}
}
