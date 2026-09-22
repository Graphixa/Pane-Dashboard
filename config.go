package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/url"
	"regexp"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Version    int        `json:"version" yaml:"version"`
	Dashboard  Dashboard  `json:"dashboard" yaml:"dashboard"`
	Appearance Appearance `json:"appearance" yaml:"appearance"`
	Items      []Pane     `json:"items" yaml:"items"`
}
type Dashboard struct {
	Branding    string `json:"branding,omitempty" yaml:"branding,omitempty"`
	BuiltinIcon string `json:"builtinIcon,omitempty" yaml:"builtinIcon,omitempty"`
	Title       string `json:"title" yaml:"title"`
	Logo        string `json:"logo,omitempty" yaml:"logo,omitempty"`
	WidthMode   string `json:"widthMode" yaml:"widthMode"`
	Width       int    `json:"width" yaml:"width"`
}
type Appearance struct {
	Background       *Background `json:"background,omitempty" yaml:"background,omitempty"`
	Glass            *Glass      `json:"glass,omitempty" yaml:"glass,omitempty"`
	Palette          *Palette    `json:"palette,omitempty" yaml:"palette,omitempty"`
	PaneTitleSize    int         `json:"paneTitleSize,omitempty" yaml:"paneTitleSize,omitempty"`
	AppSize          string      `json:"appSize,omitempty" yaml:"appSize,omitempty"` // Legacy schema 1 only.
	ShowAppLabels    bool        `json:"showAppLabels" yaml:"showAppLabels"`
	ShowButtonLabels bool        `json:"showButtonLabels" yaml:"showButtonLabels"`
	Theme            string      `json:"theme" yaml:"theme"`
}
type Geometry struct {
	X int `json:"x" yaml:"x"`
	Y int `json:"y" yaml:"y"`
	W int `json:"w" yaml:"w"`
	H int `json:"h" yaml:"h"`
}
type Pane struct {
	ID     string   `json:"id" yaml:"id"`
	Type   string   `json:"type" yaml:"type"`
	Title  string   `json:"title" yaml:"title"`
	Layout Geometry `json:"layout" yaml:"layout"`
	Apps   []App    `json:"apps" yaml:"apps"`
}
type App struct {
	ID           string  `json:"id" yaml:"id"`
	Name         string  `json:"name" yaml:"name"`
	URL          string  `json:"url" yaml:"url"`
	Icon         string  `json:"icon" yaml:"icon"`
	Col          int     `json:"col" yaml:"col"`
	Row          int     `json:"row" yaml:"row"`
	OpenInNewTab bool    `json:"openInNewTab" yaml:"openInNewTab"`
	Source       *Source `json:"source,omitempty" yaml:"source,omitempty"`
}
type Source struct {
	Provider string `json:"provider" yaml:"provider"`
	ID       string `json:"id" yaml:"id"`
}

var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,100}$`)
var iconPattern = regexp.MustCompile(`^dashboard-icons:[a-z0-9][a-z0-9-]{0,100}$`)

func defaultConfig() Config {
	return Config{Version: 2, Dashboard: Dashboard{Title: "pane.", WidthMode: "fixed", Width: 960}, Appearance: Appearance{ShowAppLabels: true, ShowButtonLabels: true, Theme: "dark"}, Items: []Pane{}}
}
func validURL(s string, empty bool) bool {
	if s == "" {
		return empty
	}
	u, e := url.Parse(s)
	return e == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" && u.User == nil && len(s) <= 2048
}
func capacity(g Geometry, width int, size string) (int, int) {
	cellW, cellH := 88, 104
	if size == "small" {
		cellW, cellH = 72, 88
	}
	if size == "large" {
		cellW, cellH = 104, 120
	}
	pw := float64(g.W)*float64(width+8)/24 - 8
	ph := g.H*32 - 8
	return int(math.Floor((pw - 24 + 8) / float64(cellW+8))), (ph - 64 + 8) / (cellH + 8)
}
func overlaps(a, b Geometry) bool {
	return a.X < b.X+b.W && a.X+a.W > b.X && a.Y < b.Y+b.H && a.Y+a.H > b.Y
}
func frame(g Geometry) Geometry { return Geometry{X: g.X, Y: g.Y, W: 4 + 14*g.W, H: 8 + 16*g.H} }
func validate(c Config) error {
	fail := func(s string) error { return fmt.Errorf("invalid configuration: %s", s) }
	if c.Version != 1 && c.Version != 2 {
		return fail("unsupported version")
	}
	if len(c.Dashboard.Title) > 100 || (c.Dashboard.WidthMode != "fixed" && c.Dashboard.WidthMode != "full") || c.Dashboard.Width < 768 || c.Dashboard.Width > 3840 {
		return fail("dashboard settings")
	}
	if c.Version == 1 && c.Appearance.AppSize != "small" && c.Appearance.AppSize != "medium" && c.Appearance.AppSize != "large" {
		return fail("app size")
	}
	if err := validateAppearance(c); err != nil {
		return fail(err.Error())
	}
	if c.Appearance.PaneTitleSize != 0 && (c.Appearance.PaneTitleSize < 14 || c.Appearance.PaneTitleSize > 22) {
		return fail("pane title size must be between 14 and 22 px")
	}
	if c.Version == 2 && c.Appearance.AppSize != "" {
		return fail("tile size is fixed in schema 2")
	}
	if c.Appearance.Theme != "dark" && c.Appearance.Theme != "light" {
		return fail("theme")
	}
	if c.Items == nil || len(c.Items) > 100 {
		return fail("items must be an array of up to 100 panes")
	}
	ids := map[string]bool{}
	total := 0
	for i, p := range c.Items {
		if !idPattern.MatchString(p.ID) || ids[p.ID] || p.Type != "pane" || len(p.Title) > 100 {
			return fail("pane identity or title")
		}
		ids[p.ID] = true
		g := p.Layout
		if c.Version == 1 && (g.X < 0 || g.Y < 0 || g.W < 1 || g.H < 1 || g.X > 24 || g.W > 24 || g.X+g.W > 24 || g.Y > 256 || g.H > 256 || g.Y+g.H > 256) {
			return fail("pane bounds")
		}
		if c.Version == 2 && (g.X < 0 || g.X > 479 || g.Y < 0 || g.Y >= 4096 || g.W < 1 || g.W > 32 || g.H < 1 || g.H > 32 || (g.X+frame(g).W)*8 > c.Dashboard.Width || g.Y+frame(g).H > 4096) {
			return fail("pane bounds")
		}
		for j := 0; j < i; j++ {
			a, b := g, c.Items[j].Layout
			if c.Version == 2 {
				a, b = frame(a), frame(b)
			}
			if overlaps(a, b) {
				return fail("panes overlap")
			}
		}
		cols, rows := capacity(g, c.Dashboard.Width, c.Appearance.AppSize)
		if c.Version == 2 {
			cols, rows = g.W, g.H
		}
		if cols < 1 || rows < 1 {
			return fail("pane too small for one app cell")
		}
		if p.Apps == nil || len(p.Apps) > 500 {
			return fail("apps must be an array of up to 500 entries")
		}
		total += len(p.Apps)
		if total > 2000 {
			return fail("too many apps")
		}
		slots := map[string]bool{}
		for _, a := range p.Apps {
			if !idPattern.MatchString(a.ID) || ids[a.ID] || len(a.Name) == 0 || len(a.Name) > 100 {
				return fail("app identity or name")
			}
			ids[a.ID] = true
			if !validURL(a.URL, true) || (a.Icon != "" && !iconPattern.MatchString(a.Icon) && !validURL(a.Icon, false)) {
				return fail("app or icon URL must be HTTP(S), without credentials")
			}
			key := fmt.Sprintf("%d:%d", a.Col, a.Row)
			if a.Col < 0 || a.Row < 0 || a.Col >= cols || a.Row >= rows || slots[key] {
				return fail("occupied or out-of-bounds app slot")
			}
			slots[key] = true
			if a.Source != nil && (a.Source.Provider != "docker" || len(a.Source.ID) == 0 || len(a.Source.ID) > 500) {
				return fail("discovery source")
			}
		}
	}
	return nil
}
func decodeJSON(data []byte) (Config, error) {
	var c Config
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if e := d.Decode(&c); e != nil {
		return c, e
	}
	var extra any
	if e := d.Decode(&extra); e != io.EOF {
		return c, fmt.Errorf("expected one configuration document")
	}
	return c, validate(c)
}
func decodeYAML(data []byte) (Config, error) {
	var c Config
	d := yaml.NewDecoder(bytes.NewReader(data))
	d.KnownFields(true)
	if e := d.Decode(&c); e != nil {
		return c, e
	}
	var extra any
	if e := d.Decode(&extra); e != io.EOF {
		return c, fmt.Errorf("expected one YAML document")
	}
	return c, validate(c)
}
