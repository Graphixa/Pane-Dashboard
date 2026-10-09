package main

import (
	"embed"
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

//go:embed web/dist
var assets embed.FS

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
func handler(s *Store, d *DockerProvider, media *MediaStore) http.Handler {
	mux := http.NewServeMux()
	registerMediaRoutes(mux, media)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		w.Header().Set("ETag", s.revision)
		respond(w, 200, s.config)
	})
	mux.HandleFunc("PUT /api/config", func(w http.ResponseWriter, r *http.Request) {
		b, ok := readJSON(w, r, "Configuration exceeds 8 MiB")
		if !ok {
			return
		}
		c, e := decodeJSON(b)
		if e != nil {
			apiError(w, 400, e.Error())
			return
		}
		if c.Version != 3 {
			apiError(w, 400, "Unsupported configuration version. Schema 3 is required; replace or delete pane.yaml (older prototypes are not migrated).")
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if r.Header.Get("If-Match") == "" {
			apiError(w, 428, "If-Match revision required")
			return
		}
		if r.Header.Get("If-Match") != s.revision {
			apiError(w, 412, "Configuration changed in another session. Reload before editing.")
			return
		}
		if e = validateConfigMedia(c, media); e != nil {
			apiError(w, 400, e.Error())
			return
		}
		if e = s.write(c); e != nil {
			log.Printf("save failed: %v", e)
			apiError(w, 500, "Could not save configuration")
			return
		}
		s.config = c
		s.revision = revision(c)
		if media != nil {
			protect := MediaGCProtect{AssetIDs: map[string]struct{}{}}
			if c.Appearance.Background != nil {
				protect.AssetIDs = collectAssetIDs(*c.Appearance.Background, c.Dashboard.Logo)
			} else if id, ok := logoAssetID(c.Dashboard.Logo); ok {
				protect.AssetIDs[id] = struct{}{}
			}
			_ = media.Cleanup(protect, time.Now().UTC())
		}
		w.Header().Set("ETag", s.revision)
		respond(w, 200, map[string]bool{"saved": true})
	})
	mux.HandleFunc("POST /api/import/preview", func(w http.ResponseWriter, r *http.Request) {
		b, ok := readJSON(w, r, "Import exceeds 8 MiB")
		if !ok {
			return
		}
		c, e := decodeJSON(b)
		if e != nil {
			apiError(w, 400, e.Error())
			return
		}
		respond(w, 200, c)
	})
	mux.HandleFunc("GET /api/discovery/docker", func(w http.ResponseWriter, r *http.Request) {
		if d == nil {
			respond(w, 200, map[string]any{"enabled": false, "apps": []Candidate{}})
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
	sub, _ := fs.Sub(assets, "web/dist")
	mux.Handle("/", http.FileServer(http.FS(sub)))
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
func main() {
	path := os.Getenv("PANE_CONFIG")
	if path == "" {
		path = "/config/pane.yaml"
	}
	s, e := openStore(path)
	if e != nil {
		log.Fatal(e)
	}
	media, e := openMediaStore(path)
	if e != nil {
		log.Fatal(e)
	}
	d, e := newDockerProvider(os.Getenv("PANE_DOCKER_ENDPOINT"))
	if e != nil {
		log.Fatal(e)
	}
	addr := os.Getenv("PANE_LISTEN")
	if addr == "" {
		addr = ":8080"
	}
	// Read/Write timeouts cover ordinary JSON; media upload/streaming uses longer bounds via
	// MaxBytesReader and ServeContent. IdleTimeout remains short.
	srv := &http.Server{Addr: addr, Handler: handler(s, d, media), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: mediaUploadTimeout + 15*time.Second, WriteTimeout: mediaUploadTimeout + 30*time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	log.Printf("Pane listening on %s; use a trusted network or authenticating reverse proxy", addr)
	log.Fatal(srv.ListenAndServe())
}
