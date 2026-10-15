package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Media limits (docs/background-media-contracts.md).
const (
	mediaImageUploadLimit  = 12 << 20
	mediaVideoUploadLimit  = 40 << 20
	mediaMaxImagePixels    = 20_000_000
	mediaMaxImageSide      = 8192
	mediaMaxVideoSide      = 1920
	mediaMaxVideoPixels    = 2_073_600
	mediaMaxVideoDuration  = 60 * time.Second
	mediaLibraryMaxEntries = 24
	mediaStorageLimit      = 500 << 20
	mediaStagingTTL        = 24 * time.Hour
	mediaNameMaxLen        = 200
)

var (
	errMediaFull        = errors.New("media storage is full")
	errMediaUnsupported = errors.New("unsupported media format")
	errMediaCorrupt     = errors.New("media is damaged or unreadable")
	errMediaTooLarge    = errors.New("media exceeds size limits")
	errMediaNotFound    = errors.New("media not found")
	errMediaInvalidID   = errors.New("invalid media id")
)

type MediaKind string

const (
	MediaKindImage MediaKind = "image"
	MediaKindVideo MediaKind = "video"
)

type MediaMeta struct {
	ID         string    `json:"id"`
	Kind       MediaKind `json:"kind"`
	MIME       string    `json:"mime"`
	Bytes      int64     `json:"bytes"`
	Width      int       `json:"width"`
	Height     int       `json:"height"`
	Name       string    `json:"name"`
	Hash       string    `json:"hash"`
	CreatedAt  time.Time `json:"createdAt"`
	DurationMs int64     `json:"durationMs,omitempty"`
	Codec      string    `json:"codec,omitempty"`
	PosterID   string    `json:"posterId,omitempty"`
	Staged     bool      `json:"staged,omitempty"`
}

type StagingInfo struct {
	SessionID  string    `json:"sessionId"`
	Meta       MediaMeta `json:"meta"`
	PreviewURL string    `json:"previewUrl"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

// MediaStore keeps uploads beside the configuration file. No database.
type MediaStore struct {
	mu      sync.Mutex
	thumbMu sync.Mutex
	root    string
}

func mediaRootBeside(configPath string) string {
	return filepath.Join(filepath.Dir(configPath), "media")
}

func openMediaStore(configPath string) (*MediaStore, error) {
	root := mediaRootBeside(configPath)
	for _, sub := range []string{"assets", "meta", "staging", "posters"} {
		if err := os.MkdirAll(filepath.Join(root, sub), 0700); err != nil {
			return nil, err
		}
	}
	return &MediaStore{root: root}, nil
}

func (m *MediaStore) Root() string { return m.root }

func validMediaID(id string) bool {
	if id == "" || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			continue
		}
		return false
	}
	return !strings.Contains(id, "..") && !strings.ContainsAny(id, `/\`)
}

func sanitizeMediaName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return "upload"
	}
	var b strings.Builder
	for _, r := range name {
		switch {
		case r < 32 || r == 127:
			continue
		case r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|':
			b.WriteByte('_')
		default:
			b.WriteRune(r)
		}
		if b.Len() >= mediaNameMaxLen {
			break
		}
	}
	if b.Len() == 0 {
		return "upload"
	}
	return b.String()
}

func newOpaqueID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func (m *MediaStore) assetPath(id string) string {
	return filepath.Join(m.root, "assets", id)
}
func (m *MediaStore) metaPath(id string) string {
	return filepath.Join(m.root, "meta", id+".json")
}
func (m *MediaStore) stagingPath(id string) string {
	return filepath.Join(m.root, "staging", id)
}
func (m *MediaStore) stagingMetaPath(id string) string {
	return filepath.Join(m.root, "staging", id+".json")
}

func (m *MediaStore) usageLocked() (int64, error) {
	var total int64
	err := filepath.Walk(m.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Mode().IsRegular() {
			total += info.Size()
		}
		return nil
	})
	return total, err
}

func (m *MediaStore) ensureQuota(additional int64) error {
	used, err := m.usageLocked()
	if err != nil {
		return err
	}
	if used+additional > mediaStorageLimit {
		return errMediaFull
	}
	return nil
}

func hashFile(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), n, nil
}

func writeJSONAtomic(path string, v any) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".meta-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	enc := json.NewEncoder(tmp)
	enc.SetIndent("", "  ")
	if err = enc.Encode(v); err != nil {
		tmp.Close()
		os.Remove(name)
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		os.Remove(name)
		return err
	}
	if err = tmp.Close(); err != nil {
		os.Remove(name)
		return err
	}
	return os.Rename(name, path)
}

func readJSONFile[T any](path string, dest *T) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dest)
}

// StageUpload streams bytes to a staging file, validates format, and returns a
// stable staging reference without modifying configuration or ETag.
func (m *MediaStore) StageUpload(r io.Reader, limit int64, filename, contentTypeHint string) (*StagingInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if err := m.ensureQuota(limit); err != nil {
		return nil, err
	}

	sessionID, err := newOpaqueID()
	if err != nil {
		return nil, err
	}
	dest := m.stagingPath(sessionID)
	f, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return nil, err
	}
	written, copyErr := io.Copy(f, io.LimitReader(r, limit+1))
	closeErr := f.Close()
	if copyErr != nil {
		os.Remove(dest)
		return nil, copyErr
	}
	if closeErr != nil {
		os.Remove(dest)
		return nil, closeErr
	}
	if written > limit {
		os.Remove(dest)
		return nil, errMediaTooLarge
	}
	if written == 0 {
		os.Remove(dest)
		return nil, errMediaCorrupt
	}

	meta, err := validateMediaFile(dest, filename, contentTypeHint)
	if err != nil {
		os.Remove(dest)
		return nil, err
	}
	meta.ID = sessionID
	meta.Staged = true
	meta.Name = sanitizeMediaName(filename)
	meta.CreatedAt = time.Now().UTC()
	hash, n, err := hashFile(dest)
	if err != nil {
		os.Remove(dest)
		return nil, err
	}
	meta.Hash = hash
	meta.Bytes = n

	if err = m.ensureQuota(0); err != nil {
		os.Remove(dest)
		return nil, err
	}
	if err = writeJSONAtomic(m.stagingMetaPath(sessionID), meta); err != nil {
		os.Remove(dest)
		return nil, err
	}

	expires := meta.CreatedAt.Add(mediaStagingTTL)
	return &StagingInfo{
		SessionID:  sessionID,
		Meta:       *meta,
		PreviewURL: "/media/staging/" + sessionID,
		ExpiresAt:  expires,
	}, nil
}

// CommitStaging promotes a staged upload into a durable asset. The returned
// asset ID is content-addressed from the file hash (sha256 hex). Idempotent for
// the same bytes.
func (m *MediaStore) CommitStaging(sessionID string) (*MediaMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !validMediaID(sessionID) {
		return nil, errMediaInvalidID
	}
	var meta MediaMeta
	if err := readJSONFile(m.stagingMetaPath(sessionID), &meta); err != nil {
		if os.IsNotExist(err) {
			return nil, errMediaNotFound
		}
		return nil, err
	}
	src := m.stagingPath(sessionID)
	if _, err := os.Stat(src); err != nil {
		return nil, errMediaNotFound
	}
	assetID := meta.Hash
	if !validMediaID(assetID) {
		return nil, errMediaInvalidID
	}
	dst := m.assetPath(assetID)
	if _, err := os.Stat(dst); err == nil {
		// Already durable; refresh meta name if missing and drop staging.
		existing, readErr := m.loadMetaLocked(assetID)
		_ = os.Remove(src)
		_ = os.Remove(m.stagingMetaPath(sessionID))
		if readErr == nil {
			return existing, nil
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	} else {
		if err := os.Rename(src, dst); err != nil {
			// Cross-device fallback.
			if err2 := copyFile(src, dst); err2 != nil {
				return nil, err2
			}
			_ = os.Remove(src)
		}
	}
	meta.ID = assetID
	meta.Staged = false
	if err := writeJSONAtomic(m.metaPath(assetID), meta); err != nil {
		return nil, err
	}
	_ = os.Remove(m.stagingMetaPath(sessionID))
	_ = os.Remove(src)
	return &meta, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		os.Remove(dst)
		return copyErr
	}
	if closeErr != nil {
		os.Remove(dst)
		return closeErr
	}
	return nil
}

func (m *MediaStore) loadMetaLocked(id string) (*MediaMeta, error) {
	var meta MediaMeta
	if err := readJSONFile(m.metaPath(id), &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func (m *MediaStore) GetMeta(id string) (*MediaMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !validMediaID(id) {
		return nil, errMediaInvalidID
	}
	meta, err := m.loadMetaLocked(id)
	if err == nil {
		_, err = os.Stat(m.assetPath(id))
	}
	if os.IsNotExist(err) {
		return nil, errMediaNotFound
	}
	if err != nil {
		return nil, err
	}
	return meta, nil
}

func (m *MediaStore) GetStagingMeta(id string) (*MediaMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !validMediaID(id) {
		return nil, errMediaInvalidID
	}
	var meta MediaMeta
	if err := readJSONFile(m.stagingMetaPath(id), &meta); err != nil {
		if os.IsNotExist(err) {
			return nil, errMediaNotFound
		}
		return nil, err
	}
	return &meta, nil
}

func (m *MediaStore) OpenAsset(id string) (*os.File, *MediaMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !validMediaID(id) {
		return nil, nil, errMediaInvalidID
	}
	meta, err := m.loadMetaLocked(id)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, errMediaNotFound
		}
		return nil, nil, err
	}
	f, err := os.Open(m.assetPath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, errMediaNotFound
		}
		return nil, nil, err
	}
	return f, meta, nil
}

func (m *MediaStore) OpenStaging(id string) (*os.File, *MediaMeta, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !validMediaID(id) {
		return nil, nil, errMediaInvalidID
	}
	var meta MediaMeta
	if err := readJSONFile(m.stagingMetaPath(id), &meta); err != nil {
		if os.IsNotExist(err) {
			return nil, nil, errMediaNotFound
		}
		return nil, nil, err
	}
	f, err := os.Open(m.stagingPath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, errMediaNotFound
		}
		return nil, nil, err
	}
	return f, &meta, nil
}

// ProtectedIDs are asset IDs that must not be deleted by GC.
type MediaGCProtect struct {
	AssetIDs   map[string]struct{}
	StagingIDs map[string]struct{}
}

// Cleanup removes expired staging sessions and unreferenced durable assets.
// Never deletes protected IDs or files merely because a picker closed.
func (m *MediaStore) Cleanup(protect MediaGCProtect, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if protect.AssetIDs == nil {
		protect.AssetIDs = map[string]struct{}{}
	}
	if protect.StagingIDs == nil {
		protect.StagingIDs = map[string]struct{}{}
	}

	stagingDir := filepath.Join(m.root, "staging")
	entries, err := os.ReadDir(stagingDir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		id := strings.TrimSuffix(name, ".json")
		if !validMediaID(id) {
			continue
		}
		if _, ok := protect.StagingIDs[id]; ok {
			continue
		}
		var meta MediaMeta
		if err := readJSONFile(m.stagingMetaPath(id), &meta); err != nil {
			continue
		}
		if now.Sub(meta.CreatedAt) < mediaStagingTTL {
			continue
		}
		_ = os.Remove(m.stagingPath(id))
		_ = os.Remove(m.stagingMetaPath(id))
	}

	metaDir := filepath.Join(m.root, "meta")
	metas, err := os.ReadDir(metaDir)
	if err != nil {
		return err
	}
	for _, e := range metas {
		name := e.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}
		id := strings.TrimSuffix(name, ".json")
		if !validMediaID(id) {
			continue
		}
		if _, ok := protect.AssetIDs[id]; ok {
			continue
		}
		_ = os.Remove(m.assetPath(id))
		_ = os.Remove(m.metaPath(id))
		poster := filepath.Join(m.root, "posters", id)
		_ = os.Remove(poster)
	}
	return nil
}

func mediaErrorStatus(err error) (int, string) {
	switch {
	case errors.Is(err, errMediaFull):
		return 507, "Media storage is full. Remove unused wallpapers or free disk space."
	case errors.Is(err, errMediaTooLarge):
		return 413, "Media exceeds the allowed size."
	case errors.Is(err, errMediaUnsupported):
		return 400, "Unsupported media format. Use PNG, JPEG, WebP, WebM or MP4."
	case errors.Is(err, errMediaCorrupt):
		return 400, "Media is damaged or unreadable."
	case errors.Is(err, errMediaNotFound):
		return 404, "Media not found."
	case errors.Is(err, errMediaInvalidID):
		return 400, "Invalid media reference."
	default:
		return 500, "Could not process media."
	}
}

func fmtMediaErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, errMediaFull) || errors.Is(err, errMediaTooLarge) ||
		errors.Is(err, errMediaUnsupported) || errors.Is(err, errMediaCorrupt) ||
		errors.Is(err, errMediaNotFound) || errors.Is(err, errMediaInvalidID) {
		return err
	}
	return fmt.Errorf("%w: %v", errMediaCorrupt, err)
}
