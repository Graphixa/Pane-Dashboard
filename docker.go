package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type DockerProvider struct {
	client *http.Client
	base   string
	scope  string
	mu     sync.Mutex
	last   time.Time
	cached []Candidate
}
type Port struct {
	IP          string `json:"ip"`
	Port        int    `json:"port"`
	PrivatePort int    `json:"privatePort"`
}
type Candidate struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Image string `json:"image"`
	Ports []Port `json:"ports"`
}
type dockerContainer struct {
	Names  []string
	Image  string
	Labels map[string]string
	Ports  []struct {
		IP          string
		PrivatePort int
		PublicPort  int
		Type        string
	}
}

func newDockerProvider(endpoint string) (*DockerProvider, error) {
	if endpoint == "" {
		return nil, nil
	}
	u, e := url.Parse(endpoint)
	if e != nil {
		return nil, e
	}
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.Proxy = nil
	base := strings.TrimRight(endpoint, "/")
	switch u.Scheme {
	case "unix":
		if u.Path == "" {
			return nil, fmt.Errorf("Docker socket path missing")
		}
		t.DialContext = func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", u.Path)
		}
		base = "http://docker"
	case "http", "https":
		if u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return nil, fmt.Errorf("invalid Docker endpoint")
		}
	default:
		return nil, fmt.Errorf("Docker endpoint must use unix, http or https")
	}
	return &DockerProvider{client: &http.Client{Transport: t, Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, base: base, scope: fmt.Sprintf("%x", sha256.Sum256([]byte(endpoint)))[:12]}, nil
}
func (d *DockerProvider) get(ctx context.Context, p string, out any) error {
	req, e := http.NewRequestWithContext(ctx, "GET", d.base+p, nil)
	if e != nil {
		return e
	}
	res, e := d.client.Do(req)
	if e != nil {
		return e
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("Docker returned %d", res.StatusCode)
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, (4<<20)+1))
	if e != nil {
		return e
	}
	if len(b) > 4<<20 {
		return fmt.Errorf("Docker response too large")
	}
	return json.Unmarshal(b, out)
}

var apiVersion = regexp.MustCompile(`^1\.[0-9]{1,3}$`)

func (d *DockerProvider) Scan(ctx context.Context) ([]Candidate, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if time.Since(d.last) < 10*time.Second {
		return d.cached, nil
	}
	var version struct {
		APIVersion string `json:"ApiVersion"`
	}
	if e := d.get(ctx, "/version", &version); e != nil {
		return nil, e
	}
	if !apiVersion.MatchString(version.APIVersion) {
		return nil, fmt.Errorf("invalid Docker API version")
	}
	var containers []dockerContainer
	if e := d.get(ctx, "/v"+version.APIVersion+"/containers/json", &containers); e != nil {
		return nil, e
	}
	out := make([]Candidate, 0, len(containers))
	for _, c := range containers {
		out = append(out, candidate(c, d.scope))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	d.last = time.Now()
	d.cached = out
	return out, nil
}
func candidate(c dockerContainer, scope string) Candidate {
	name := c.Labels["com.docker.compose.service"]
	containerName := ""
	if len(c.Names) > 0 {
		containerName = strings.TrimPrefix(c.Names[0], "/")
	}
	if name == "" {
		name = containerName
	}
	if name == "" {
		name = path.Base(strings.Split(c.Image, "@")[0])
		name = strings.Split(name, ":")[0]
	}
	identity := "name:" + containerName
	if project := c.Labels["com.docker.compose.project"]; project != "" && c.Labels["com.docker.compose.service"] != "" {
		identity = "compose:" + project + ":" + c.Labels["com.docker.compose.service"]
	}
	ports := []Port{}
	for _, p := range c.Ports {
		if p.Type == "tcp" && p.PublicPort > 0 && p.PublicPort <= 65535 {
			ports = append(ports, Port{IP: p.IP, Port: p.PublicPort, PrivatePort: p.PrivatePort})
		}
	}
	return Candidate{ID: scope + ":" + identity, Name: name, Image: c.Image, Ports: ports}
}
