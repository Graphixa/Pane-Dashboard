package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Graphixa/Pane-Dashboard/internal/archive"
	"github.com/Graphixa/Pane-Dashboard/internal/builtin"
	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/docker"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
	"github.com/Graphixa/Pane-Dashboard/internal/ui"
)

const configLimit = 8 << 20

// UploadTimeout bounds media upload/streaming requests; ordinary JSON ops keep
// short timeouts via the server configuration in cmd/pane.
const UploadTimeout = 120 * time.Second

func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func apiError(w http.ResponseWriter, status int, s string) {
	respond(w, status, map[string]string{"error": s})
}
func readJSON(w http.ResponseWriter, r *http.Request, limitMsg string) ([]byte, bool) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		apiError(w, 415, "Use application/json")
		return nil, false
	}
	b, e := io.ReadAll(http.MaxBytesReader(w, r.Body, configLimit))
	if e != nil {
		apiError(w, 413, limitMsg)
		return nil, false
	}
	return b, true
}

// Handler builds the complete HTTP handler tree for the server.
func Handler(s *config.Store, d *docker.DockerProvider, store *media.MediaStore) http.Handler {
	mux := http.NewServeMux()
	registerMediaRoutes(mux, store)
	builtin.RegisterRoutes(mux)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		c, rev := s.GetWithRevision()
		w.Header().Set("ETag", rev)
		respond(w, 200, c)
	})
	mux.HandleFunc("PUT /api/config", func(w http.ResponseWriter, r *http.Request) {
		b, ok := readJSON(w, r, "Configuration exceeds 8 MiB")
		if !ok {
			return
		}
		c, e := config.DecodeJSON(b)
		if e != nil {
			apiError(w, 400, e.Error())
			return
		}
		if c.Version != 3 {
			apiError(w, 400, "Unsupported configuration version. Schema 3 is required; replace or delete pane.yaml (older prototypes are not migrated).")
			return
		}
		rev, err := s.SaveWithRevision(r.Header.Get("If-Match"), c, func(cc config.Config) error {
			return archive.ValidateConfigMedia(cc, store)
		})
		var verr *config.ValidationError
		switch {
		case errors.Is(err, config.ErrRevisionRequired):
			apiError(w, 428, err.Error())
			return
		case errors.Is(err, config.ErrRevisionMismatch):
			apiError(w, 412, err.Error())
			return
		case errors.As(err, &verr):
			apiError(w, 400, verr.Error())
			return
		case err != nil:
			log.Printf("save failed: %v", err)
			apiError(w, 500, "Could not save configuration")
			return
		}
		if store != nil {
			protect := media.MediaGCProtect{AssetIDs: map[string]struct{}{}}
			if c.Appearance.Background != nil {
				protect.AssetIDs = config.CollectAssetIDs(*c.Appearance.Background, c.Dashboard.Logo)
			} else if id, ok := config.LogoAssetID(c.Dashboard.Logo); ok {
				protect.AssetIDs[id] = struct{}{}
			}
			_ = store.Cleanup(protect, time.Now().UTC())
		}
		w.Header().Set("ETag", rev)
		respond(w, 200, map[string]bool{"saved": true})
	})
	mux.HandleFunc("POST /api/import/preview", func(w http.ResponseWriter, r *http.Request) {
		b, ok := readJSON(w, r, "Import exceeds 8 MiB")
		if !ok {
			return
		}
		c, e := config.DecodeJSON(b)
		if e != nil {
			apiError(w, 400, e.Error())
			return
		}
		respond(w, 200, c)
	})
	mux.HandleFunc("GET /api/discovery/docker", func(w http.ResponseWriter, r *http.Request) {
		if d == nil {
			respond(w, 200, map[string]any{"enabled": false, "apps": []docker.Candidate{}})
			return
		}
		apps, e := d.Scan(r.Context())
		if e != nil {
			log.Printf("discovery failed: %v", e)
			apiError(w, 502, "Docker scan failed. Check endpoint configuration and server logs.")
			return
		}
		respond(w, 200, map[string]any{"enabled": true, "apps": apps})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { apiError(w, 404, "Unknown endpoint") })
	mux.Handle("/", http.FileServer(http.FS(ui.FS())))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' https: http: data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			origin := r.Header.Get("Origin")
			if origin != "" {
				u, e := url.Parse(origin)
				if e != nil || u.Host != r.Host {
					apiError(w, 403, "Cross-origin changes are not allowed")
					return
				}
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				apiError(w, 403, "Cross-site changes are not allowed")
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}
