package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Graphixa/Pane-Dashboard/internal/api"
	"github.com/Graphixa/Pane-Dashboard/internal/config"
	"github.com/Graphixa/Pane-Dashboard/internal/docker"
	"github.com/Graphixa/Pane-Dashboard/internal/media"
)

func main() {
	path := os.Getenv("PANE_CONFIG")
	if path == "" {
		path = "/config/pane.yaml"
	}
	s, e := config.Open(path)
	if e != nil {
		log.Fatal(e)
	}
	store, e := media.Open(path)
	if e != nil {
		log.Fatal(e)
	}
	d, e := docker.NewProvider(os.Getenv("PANE_DOCKER_ENDPOINT"))
	if e != nil {
		log.Fatal(e)
	}
	addr := listenAddr()
	// Read/Write timeouts cover ordinary JSON; media upload/streaming uses longer bounds via
	// MaxBytesReader and ServeContent. IdleTimeout remains short.
	srv := &http.Server{Addr: addr, Handler: api.Handler(s, d, store), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: api.UploadTimeout + 15*time.Second, WriteTimeout: api.UploadTimeout + 30*time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	log.Printf("Pane listening on %s; use a trusted network or authenticating reverse proxy", addr)
	log.Fatal(srv.ListenAndServe())
}

// listenAddr defaults to loopback so local runs do not open inbound LAN sockets
// (and so Windows Firewall is not prompted). Containers set PANE_LISTEN=:8080.
func listenAddr() string {
	if addr := os.Getenv("PANE_LISTEN"); addr != "" {
		return addr
	}
	return "127.0.0.1:8080"
}
