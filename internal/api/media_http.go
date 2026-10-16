package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
)

func registerMediaRoutes(mux *http.ServeMux, store *media.MediaStore) {
	if store == nil {
		return
	}
	mux.HandleFunc("POST /api/media/upload", func(w http.ResponseWriter, r *http.Request) {
		handleMediaUpload(w, r, store)
	})
	mux.HandleFunc("POST /api/media/commit", func(w http.ResponseWriter, r *http.Request) {
		handleMediaCommit(w, r, store)
	})
	mux.HandleFunc("GET /api/media/meta/{id}", func(w http.ResponseWriter, r *http.Request) {
		handleMediaMeta(w, r, store)
	})
	mux.HandleFunc("PUT /api/media/poster/{id}", func(w http.ResponseWriter, r *http.Request) {
		handleMediaPosterPut(w, r, store)
	})
	mux.HandleFunc("GET /media/assets/{id}/poster", func(w http.ResponseWriter, r *http.Request) {
		serveMediaPoster(w, r, store)
	})
	mux.HandleFunc("GET /media/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, store, false)
	})
	mux.HandleFunc("HEAD /media/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, store, false)
	})
	mux.HandleFunc("GET /media/staging/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, store, true)
	})
	mux.HandleFunc("HEAD /media/staging/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, store, true)
	})
}

func handleMediaMeta(w http.ResponseWriter, r *http.Request, store *media.MediaStore) {
	w.Header().Set("Cache-Control", "private, no-store")
	id := r.PathValue("id")
	if !config.ValidMediaID(id) {
		apiError(w, 400, "Invalid media reference.")
		return
	}
	meta, err := store.GetMeta(id)
	if err != nil {
		status, msg := media.ErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	respond(w, 200, meta)
}

func handleMediaCommit(w http.ResponseWriter, r *http.Request, store *media.MediaStore) {
	b, ok := readJSON(w, r, "Request too large")
	if !ok {
		return
	}
	var body struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(b, &body); err != nil || !config.ValidMediaID(body.SessionID) {
		apiError(w, 400, "Invalid staging session.")
		return
	}
	meta, err := store.CommitStaging(body.SessionID)
	if err != nil {
		status, msg := media.ErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	respond(w, 200, map[string]any{
		"assetId":    meta.ID,
		"previewUrl": "/media/assets/" + meta.ID,
		"meta":       meta,
	})
}

func handleMediaUpload(w http.ResponseWriter, r *http.Request, store *media.MediaStore) {
	ct := r.Header.Get("Content-Type")
	filename := r.Header.Get("X-Pane-Filename")
	if filename == "" {
		filename = "upload"
	}

	limit := int64(media.ImageUploadLimit)
	lower := strings.ToLower(ct)
	if strings.HasPrefix(lower, "video/") || strings.HasSuffix(strings.ToLower(filename), ".webm") ||
		strings.HasSuffix(strings.ToLower(filename), ".mp4") || strings.HasSuffix(strings.ToLower(filename), ".m4v") {
		limit = media.VideoUploadLimit
	}

	// Multipart optional: prefer raw body for simplicity; also accept multipart file.
	var body io.Reader = http.MaxBytesReader(w, r.Body, limit+1)
	if strings.HasPrefix(lower, "multipart/") {
		if err := r.ParseMultipartForm(limit + (1 << 20)); err != nil {
			apiError(w, 413, "Media exceeds the allowed size.")
			return
		}
		file, hdr, err := r.FormFile("file")
		if err != nil {
			apiError(w, 400, "Expected a media file field named file.")
			return
		}
		defer file.Close()
		body = http.MaxBytesReader(w, file, limit+1)
		if filename == "upload" && hdr != nil && hdr.Filename != "" {
			filename = hdr.Filename
		}
		if ct == "" || strings.HasPrefix(lower, "multipart/") {
			ct = hdr.Header.Get("Content-Type")
		}
	}

	info, err := store.StageUpload(body, limit, filename, ct)
	if err != nil {
		status, msg := media.ErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	respond(w, 200, info)
}

func serveMedia(w http.ResponseWriter, r *http.Request, store *media.MediaStore, staged bool) {
	id := r.PathValue("id")
	if !config.ValidMediaID(id) {
		apiError(w, 400, "Invalid media reference.")
		return
	}
	var (
		f    *os.File
		meta *media.MediaMeta
		err  error
	)
	if staged {
		f, meta, err = store.OpenStaging(id)
	} else {
		f, meta, err = store.OpenAsset(id)
	}
	if err != nil {
		status, msg := media.ErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		apiError(w, 500, "Could not read media.")
		return
	}

	w.Header().Set("Content-Type", meta.MIME)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Accept-Ranges", "bytes")
	if staged {
		w.Header().Set("Cache-Control", "private, no-store")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("ETag", `"`+meta.Hash+`"`)
		if match := r.Header.Get("If-None-Match"); match != "" && strings.Contains(match, meta.Hash) {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	http.ServeContent(w, r, meta.Name, stat.ModTime(), f)
}

func serveMediaPoster(w http.ResponseWriter, r *http.Request, store *media.MediaStore) {
	file, err := store.OpenPoster(r.PathValue("id"))
	if err != nil {
		w.Header().Set("Cache-Control", "private, no-store")
		status, message := media.ErrorStatus(err)
		apiError(w, status, message)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		apiError(w, 500, "Could not read thumbnail.")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"poster-v1-`+r.PathValue("id")+`"`)
	http.ServeContent(w, r, "thumbnail.jpg", info.ModTime(), file)
}

func handleMediaPosterPut(w http.ResponseWriter, r *http.Request, store *media.MediaStore) {
	w.Header().Set("Cache-Control", "private, no-store")
	id := r.PathValue("id")
	if !config.ValidMediaID(id) {
		apiError(w, 400, "Invalid media reference.")
		return
	}
	body := http.MaxBytesReader(w, r.Body, media.PosterUploadLimit+1)
	if err := store.SaveVideoPoster(id, body, media.PosterUploadLimit); err != nil {
		status, message := media.ErrorStatus(err)
		apiError(w, status, message)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// mediaReadTimeout reports the per-request read timeout; media endpoints get a
// longer bound than ordinary JSON.
func mediaReadTimeout(r *http.Request) time.Duration {
	if r != nil && strings.HasPrefix(r.URL.Path, "/api/media/") {
		return UploadTimeout
	}
	return 15 * time.Second
}

func parseContentLength(r *http.Request) int64 {
	v := r.Header.Get("Content-Length")
	if v == "" {
		return -1
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return -1
	}
	return n
}
