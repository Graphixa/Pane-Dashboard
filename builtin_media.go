package main

import (
	"embed"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
)

//go:embed all:builtin
var builtinPack embed.FS

type builtinCatalogue struct {
	Version    int                    `json:"version"`
	Categories []builtinCategory      `json:"categories"`
	Items      []builtinCatalogueItem `json:"items"`
}

type builtinCategory struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Order   int      `json:"order"`
	CoverID string   `json:"coverId"`
	ItemIDs []string `json:"itemIds"`
}

type builtinCatalogueItem struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	MIME     string `json:"mime"`
	File     string `json:"file"`
	Bytes    int64  `json:"bytes"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Title    string `json:"title"`
	Hash     string `json:"hash"`
	PosterID string `json:"posterId,omitempty"`
}

var (
	builtinOnce sync.Once
	builtinIdx  map[string]builtinCatalogueItem
	builtinErr  error
)

func loadBuiltinIndex() (map[string]builtinCatalogueItem, error) {
	builtinOnce.Do(func() {
		builtinIdx = map[string]builtinCatalogueItem{}
		raw, err := fs.ReadFile(builtinPack, "builtin/catalogue.json")
		if err != nil {
			builtinErr = err
			return
		}
		var cat builtinCatalogue
		if err := json.Unmarshal(raw, &cat); err != nil {
			builtinErr = err
			return
		}
		for _, item := range cat.Items {
			if item.ID == "" || item.File == "" {
				continue
			}
			builtinIdx[item.ID] = item
		}
	})
	return builtinIdx, builtinErr
}

func validBuiltinID(id string) bool {
	if id == "" || len(id) > 128 || strings.Contains(id, "..") || strings.ContainsAny(id, `/\`) {
		return false
	}
	at := strings.LastIndex(id, "@v")
	if at <= 0 || at >= len(id)-2 {
		return false
	}
	name, ver := id[:at], id[at+2:]
	if name == "" || ver == "" {
		return false
	}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			continue
		}
		return false
	}
	for _, r := range ver {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func registerBuiltinRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /media/builtin/{id}", serveBuiltin)
	mux.HandleFunc("HEAD /media/builtin/{id}", serveBuiltin)
}

func serveBuiltin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if decoded, err := url.PathUnescape(id); err == nil {
		id = decoded
	}
	if !validBuiltinID(id) {
		apiError(w, 400, "Invalid built-in media reference.")
		return
	}
	idx, err := loadBuiltinIndex()
	if err != nil {
		apiError(w, 500, "Built-in catalogue unavailable.")
		return
	}
	item, ok := idx[id]
	if !ok {
		apiError(w, 404, "Built-in media not found.")
		return
	}
	filePath := path.Clean(item.File)
	filePath = strings.TrimPrefix(filePath, "/")
	if filePath != item.File || !strings.HasPrefix(filePath, "media/") {
		apiError(w, 500, "Built-in media path invalid.")
		return
	}
	f, err := builtinPack.Open("builtin/" + filePath)
	if err != nil {
		apiError(w, 404, "Built-in media not found.")
		return
	}
	defer f.Close()
	stat, err := f.Stat()
	if err != nil {
		apiError(w, 500, "Could not read built-in media.")
		return
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		apiError(w, 500, "Could not read built-in media.")
		return
	}
	w.Header().Set("Content-Type", item.MIME)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	if item.Hash != "" {
		w.Header().Set("ETag", `"`+item.Hash+`"`)
		if match := r.Header.Get("If-None-Match"); match != "" && strings.Contains(match, item.Hash) {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}
	http.ServeContent(w, r, item.Title, stat.ModTime(), rs)
}
