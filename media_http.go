package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const mediaUploadTimeout = 120 * time.Second

func registerMediaRoutes(mux *http.ServeMux, media *MediaStore) {
	if media == nil {
		return
	}
	mux.HandleFunc("POST /api/media/upload", func(w http.ResponseWriter, r *http.Request) {
		handleMediaUpload(w, r, media)
	})
	mux.HandleFunc("POST /api/media/commit", func(w http.ResponseWriter, r *http.Request) {
		handleMediaCommit(w, r, media)
	})
	mux.HandleFunc("GET /media/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, media, false)
	})
	mux.HandleFunc("HEAD /media/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, media, false)
	})
	mux.HandleFunc("GET /media/staging/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, media, true)
	})
	mux.HandleFunc("HEAD /media/staging/{id}", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(w, r, media, true)
	})
}

func handleMediaCommit(w http.ResponseWriter, r *http.Request, media *MediaStore) {
	b, ok := readJSON(w, r, "Request too large")
	if !ok {
		return
	}
	var body struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(b, &body); err != nil || !validMediaID(body.SessionID) {
		apiError(w, 400, "Invalid staging session.")
		return
	}
	meta, err := media.CommitStaging(body.SessionID)
	if err != nil {
		status, msg := mediaErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	respond(w, 200, map[string]any{
		"assetId":    meta.ID,
		"previewUrl": "/media/assets/" + meta.ID,
		"meta":       meta,
	})
}

func handleMediaUpload(w http.ResponseWriter, r *http.Request, media *MediaStore) {
	ct := r.Header.Get("Content-Type")
	filename := r.Header.Get("X-Pane-Filename")
	if filename == "" {
		filename = "upload"
	}

	limit := int64(mediaImageUploadLimit)
	lower := strings.ToLower(ct)
	if strings.HasPrefix(lower, "video/") || strings.HasSuffix(strings.ToLower(filename), ".webm") ||
		strings.HasSuffix(strings.ToLower(filename), ".mp4") || strings.HasSuffix(strings.ToLower(filename), ".m4v") {
		limit = mediaVideoUploadLimit
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

	info, err := media.StageUpload(body, limit, filename, ct)
	if err != nil {
		status, msg := mediaErrorStatus(err)
		apiError(w, status, msg)
		return
	}
	respond(w, 200, info)
}

func serveMedia(w http.ResponseWriter, r *http.Request, media *MediaStore, staged bool) {
	id := r.PathValue("id")
	if !validMediaID(id) {
		apiError(w, 400, "Invalid media reference.")
		return
	}
	var (
		f    *os.File
		meta *MediaMeta
		err  error
	)
	if staged {
		f, meta, err = media.OpenStaging(id)
	} else {
		f, meta, err = media.OpenAsset(id)
	}
	if err != nil {
		status, msg := mediaErrorStatus(err)
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

// withMediaUploadTimeout wraps the handler so ordinary JSON ops keep short
// timeouts while media uploads may run longer. Applied at Server construction.
func mediaReadTimeout(r *http.Request) time.Duration {
	if r != nil && strings.HasPrefix(r.URL.Path, "/api/media/") {
		return mediaUploadTimeout
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
