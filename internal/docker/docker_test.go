package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDockerSanitisedAndReadOnly(t *testing.T) {
	calls := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch r.URL.Path {
		case "/version":
			w.Write([]byte(`{"ApiVersion":"1.45"}`))
		case "/v1.45/containers/json":
			w.Write([]byte(`[{"Id":"volatile","Names":["/media-sonarr-1"],"Image":"linuxserver/sonarr:latest","Labels":{"com.docker.compose.project":"media","com.docker.compose.service":"sonarr","private":"secret"},"Ports":[{"IP":"0.0.0.0","PublicPort":8989,"PrivatePort":8989,"Type":"tcp"}]}]`))
		default:
			t.Error("unexpected Docker endpoint")
		}
	}))
	defer server.Close()
	d, e := NewProvider(server.URL)
	if e != nil {
		t.Fatal(e)
	}
	apps, e := d.Scan(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(apps)
	if bytes.Contains(b, []byte("secret")) || bytes.Contains(b, []byte("volatile")) || len(apps) != 1 || apps[0].Name != "sonarr" {
		t.Fatal("bad candidates", string(b))
	}
	if len(calls) != 2 || calls[0] != "GET /version" {
		t.Fatal(calls)
	}
}
