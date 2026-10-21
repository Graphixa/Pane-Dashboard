package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"
)

type Config struct {
	Version        int            `json:"version" yaml:"version"`
	DashboardID    string         `json:"dashboardId" yaml:"dashboardId"`
	Dashboard      Dashboard      `json:"dashboard" yaml:"dashboard"`
	Appearance     Appearance     `json:"appearance" yaml:"appearance"`
	DefaultSpaceID string         `json:"defaultSpaceId" yaml:"defaultSpaceId"`
	Apps           []AppDefinition `json:"apps" yaml:"apps"`
	Spaces         []Space        `json:"spaces" yaml:"spaces"`
}

type Dashboard struct {
	Title       string `json:"title" yaml:"title"`
	ShowTitle   *bool  `json:"showTitle,omitempty" yaml:"showTitle,omitempty"`
	ShowIcon    *bool  `json:"showIcon,omitempty" yaml:"showIcon,omitempty"`
	BuiltinIcon string `json:"builtinIcon,omitempty" yaml:"builtinIcon,omitempty"`
	Icon        string `json:"icon,omitempty" yaml:"icon,omitempty"`
	Logo        string `json:"logo,omitempty" yaml:"logo,omitempty"`
	WidthMode   string `json:"widthMode" yaml:"widthMode"`
	Width       int    `json:"width" yaml:"width"`
}

type Appearance struct {
	Background       *Background `json:"background,omitempty" yaml:"background,omitempty"`
	Glass            *Glass      `json:"glass,omitempty" yaml:"glass,omitempty"`
	Palette          *Palette    `json:"palette,omitempty" yaml:"palette,omitempty"`
	PaneTitleSize    int         `json:"paneTitleSize,omitempty" yaml:"paneTitleSize,omitempty"`
	FontFamily       string      `json:"fontFamily,omitempty" yaml:"fontFamily,omitempty"`
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

type Space struct {
	ID    string `json:"id" yaml:"id"`
	Name  string `json:"name" yaml:"name"`
	Items []Pane `json:"items" yaml:"items"`
}

type Pane struct {
	ID     string         `json:"id" yaml:"id"`
	Type   string         `json:"type" yaml:"type"`
	Title  string         `json:"title" yaml:"title"`
	Layout Geometry       `json:"layout" yaml:"layout"`
	Apps   []AppPlacement `json:"apps" yaml:"apps"`
}

type AppDefinition struct {
	ID           string  `json:"id" yaml:"id"`
	Name         string  `json:"name" yaml:"name"`
	URL          string  `json:"url" yaml:"url"`
	Icon         string  `json:"icon" yaml:"icon"`
	OpenInNewTab bool    `json:"openInNewTab" yaml:"openInNewTab"`
	Source       *Source `json:"source,omitempty" yaml:"source,omitempty"`
}

type AppPlacement struct {
	ID    string `json:"id" yaml:"id"`
	AppID string `json:"appId" yaml:"appId"`
	Col   int    `json:"col" yaml:"col"`
	Row   int    `json:"row" yaml:"row"`
}

type Source struct {
	Provider string `json:"provider" yaml:"provider"`
	ID       string `json:"id" yaml:"id"`
}

const (
	MaxSpaces            = 12
	MaxSpaceName         = 48
	MaxPanes             = 100
	MaxDefinitions       = 2000
	MaxPlacements        = 2000
	MaxPlacementsPerPane = 500
)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,100}$`)
var iconPattern = regexp.MustCompile(`^dashboard-icons:[a-z0-9][a-z0-9-]{0,100}$`)

func boolPtr(v bool) *bool { return &v }

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func DefaultConfig() Config {
	homeID := "home"
	return Config{
		Version:     4,
		DashboardID: newID(),
		Dashboard: Dashboard{
			Title:     "pane.",
			ShowTitle: boolPtr(true),
			ShowIcon:  boolPtr(true),
			WidthMode: "fixed",
			Width:     960,
		},
		Appearance:     Appearance{ShowAppLabels: true, ShowButtonLabels: true, Theme: "dark"},
		DefaultSpaceID: homeID,
		Apps:           []AppDefinition{},
		Spaces:         []Space{{ID: homeID, Name: "Home", Items: []Pane{}}},
	}
}

// BoolOrDefault treats a missing *bool as def (used for showTitle / showIcon).
func BoolOrDefault(p *bool, def bool) bool {
	if p == nil {
		return def
	}
	return *p
}

func spaceNameKey(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

func validURL(s string, empty bool) bool {
	if s == "" {
		return empty
	}
	u, e := url.Parse(s)
	return e == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" && u.User == nil && len(s) <= 2048
}

func overlaps(a, b Geometry) bool {
	return a.X < b.X+b.W && a.X+a.W > b.X && a.Y < b.Y+b.H && a.Y+a.H > b.Y
}
func frame(g Geometry) Geometry { return Geometry{X: g.X, Y: g.Y, W: 4 + 14*g.W, H: 8 + 16*g.H} }

func Validate(c Config) error {
	fail := func(s string) error { return fmt.Errorf("invalid configuration: %s", s) }
	if c.Version != 4 {
		return fail("unsupported version (schema 4 required)")
	}
	if !idPattern.MatchString(c.DashboardID) {
		return fail("dashboard identity")
	}
	if len(c.Dashboard.Title) > 100 || (c.Dashboard.WidthMode != "fixed" && c.Dashboard.WidthMode != "full") || c.Dashboard.Width < 768 || c.Dashboard.Width > 3840 {
		return fail("dashboard settings")
	}
	if err := validateAppearance(c); err != nil {
		return fail(err.Error())
	}
	if c.Appearance.PaneTitleSize != 0 && (c.Appearance.PaneTitleSize < 14 || c.Appearance.PaneTitleSize > 22) {
		return fail("pane title size must be between 14 and 22 px")
	}
	if c.Appearance.FontFamily != "" && c.Appearance.FontFamily != "geist" && c.Appearance.FontFamily != "rubik" && c.Appearance.FontFamily != "oxanium" {
		return fail("font family must be geist, rubik or oxanium")
	}
	if c.Appearance.AppSize != "" {
		return fail("tile size is fixed")
	}
	if c.Appearance.Theme != "dark" && c.Appearance.Theme != "light" {
		return fail("theme")
	}
	if c.Apps == nil || len(c.Apps) > MaxDefinitions {
		return fail("apps must be an array of up to 2000 definitions")
	}
	defs := map[string]bool{}
	for _, a := range c.Apps {
		if !idPattern.MatchString(a.ID) || defs[a.ID] || len(a.Name) == 0 || len(a.Name) > 100 {
			return fail("app identity or name")
		}
		defs[a.ID] = true
		if !validURL(a.URL, true) || (a.Icon != "" && !iconPattern.MatchString(a.Icon) && !validURL(a.Icon, false)) {
			return fail("app or icon URL must be HTTP(S), without credentials")
		}
		if a.Source != nil && (a.Source.Provider != "docker" || len(a.Source.ID) == 0 || len(a.Source.ID) > 500) {
			return fail("discovery source")
		}
	}
	if c.Spaces == nil || len(c.Spaces) < 1 || len(c.Spaces) > MaxSpaces {
		return fail("spaces must be an array of 1 to 12 spaces")
	}
	if !idPattern.MatchString(c.DefaultSpaceID) {
		return fail("default space")
	}
	spaceIDs := map[string]bool{}
	nameKeys := map[string]bool{}
	paneIDs := map[string]bool{}
	placementIDs := map[string]bool{}
	totalPanes := 0
	totalPlacements := 0
	defaultOK := false
	for _, s := range c.Spaces {
		if !idPattern.MatchString(s.ID) || spaceIDs[s.ID] {
			return fail("space identity")
		}
		spaceIDs[s.ID] = true
		if s.ID == c.DefaultSpaceID {
			defaultOK = true
		}
		trimmed := strings.TrimSpace(s.Name)
		if trimmed == "" || utf8.RuneCountInString(trimmed) > MaxSpaceName {
			return fail("space name")
		}
		nk := spaceNameKey(s.Name)
		if nameKeys[nk] {
			return fail("duplicate space name")
		}
		nameKeys[nk] = true
		if s.Items == nil {
			return fail("space items")
		}
		for i, p := range s.Items {
			if !idPattern.MatchString(p.ID) || paneIDs[p.ID] || p.Type != "pane" || len(p.Title) > 100 {
				return fail("pane identity or title")
			}
			paneIDs[p.ID] = true
			totalPanes++
			if totalPanes > MaxPanes {
				return fail("too many panes")
			}
			g := p.Layout
			if g.X < 0 || g.X > 479 || g.Y < 0 || g.Y >= 4096 || g.W < 1 || g.W > 32 || g.H < 1 || g.H > 32 || (g.X+frame(g).W)*8 > c.Dashboard.Width || g.Y+frame(g).H > 4096 {
				return fail("pane bounds")
			}
			for j := 0; j < i; j++ {
				a, b := frame(g), frame(s.Items[j].Layout)
				if overlaps(a, b) {
					return fail("panes overlap")
				}
			}
			cols, rows := g.W, g.H
			if cols < 1 || rows < 1 {
				return fail("pane too small for one app cell")
			}
			if p.Apps == nil || len(p.Apps) > MaxPlacementsPerPane {
				return fail("apps must be an array of up to 500 placements")
			}
			slots := map[string]bool{}
			for _, a := range p.Apps {
				if !idPattern.MatchString(a.ID) || placementIDs[a.ID] || !idPattern.MatchString(a.AppID) || !defs[a.AppID] {
					return fail("app placement")
				}
				placementIDs[a.ID] = true
				totalPlacements++
				if totalPlacements > MaxPlacements {
					return fail("too many placements")
				}
				key := fmt.Sprintf("%d:%d", a.Col, a.Row)
				if a.Col < 0 || a.Row < 0 || a.Col >= cols || a.Row >= rows || slots[key] {
					return fail("occupied or out-of-bounds app slot")
				}
				slots[key] = true
			}
		}
	}
	if !defaultOK {
		return fail("default space must exist")
	}
	return nil
}

func asInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case int64:
		return int(n), true
	case float64:
		if n == float64(int(n)) {
			return int(n), true
		}
	}
	return 0, false
}

// DecodeJSON accepts schema 4, or converts schema 3 at import/load boundaries.
func DecodeJSON(data []byte) (Config, error) {
	return decodeDocument(data, "json")
}

// DecodeYAML accepts schema 4, or converts schema 3 at import/load boundaries.
func DecodeYAML(data []byte) (Config, error) {
	return decodeDocument(data, "yaml")
}

// DecodeJSONStrictV4 accepts only runtime schema 4 (ordinary PUT).
func DecodeJSONStrictV4(data []byte) (Config, error) {
	return decodeDocumentStrictV4(data)
}
