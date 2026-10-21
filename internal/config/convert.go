package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	"gopkg.in/yaml.v3"
)

// ConfigV3 is the previous single-layout schema, accepted only at conversion boundaries.
type ConfigV3 struct {
	Version    int        `json:"version" yaml:"version"`
	Dashboard  Dashboard  `json:"dashboard" yaml:"dashboard"`
	Appearance Appearance `json:"appearance" yaml:"appearance"`
	Items      []PaneV3   `json:"items" yaml:"items"`
}

type PaneV3 struct {
	ID     string   `json:"id" yaml:"id"`
	Type   string   `json:"type" yaml:"type"`
	Title  string   `json:"title" yaml:"title"`
	Layout Geometry `json:"layout" yaml:"layout"`
	Apps   []AppV3  `json:"apps" yaml:"apps"`
}

type AppV3 struct {
	ID           string  `json:"id" yaml:"id"`
	Name         string  `json:"name" yaml:"name"`
	URL          string  `json:"url" yaml:"url"`
	Icon         string  `json:"icon" yaml:"icon"`
	Col          int     `json:"col" yaml:"col"`
	Row          int     `json:"row" yaml:"row"`
	OpenInNewTab bool    `json:"openInNewTab" yaml:"openInNewTab"`
	Source       *Source `json:"source,omitempty" yaml:"source,omitempty"`
}

func validateV3(c ConfigV3) error {
	fail := func(s string) error { return fmt.Errorf("invalid configuration: %s", s) }
	if c.Version != 3 {
		return fail("unsupported version")
	}
	if len(c.Dashboard.Title) > 100 || (c.Dashboard.WidthMode != "fixed" && c.Dashboard.WidthMode != "full") || c.Dashboard.Width < 768 || c.Dashboard.Width > 3840 {
		return fail("dashboard settings")
	}
	// Appearance checks reuse schema-4 helpers via a temporary Config shell.
	tmp := Config{Version: 4, Dashboard: c.Dashboard, Appearance: c.Appearance, DashboardID: "tmp", DefaultSpaceID: "home", Apps: []AppDefinition{}, Spaces: []Space{{ID: "home", Name: "Home", Items: []Pane{}}}}
	if err := validateAppearance(tmp); err != nil {
		return fail(err.Error())
	}
	if c.Appearance.PaneTitleSize != 0 && (c.Appearance.PaneTitleSize < 14 || c.Appearance.PaneTitleSize > 22) {
		return fail("pane title size must be between 14 and 22 px")
	}
	if c.Appearance.FontFamily != "" && c.Appearance.FontFamily != "geist" && c.Appearance.FontFamily != "rubik" && c.Appearance.FontFamily != "oxanium" {
		return fail("font family must be geist, rubik or oxanium")
	}
	if c.Appearance.AppSize != "" {
		return fail("tile size is fixed in schema 3")
	}
	if c.Appearance.Theme != "dark" && c.Appearance.Theme != "light" {
		return fail("theme")
	}
	if c.Items == nil || len(c.Items) > MaxPanes {
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
		if g.X < 0 || g.X > 479 || g.Y < 0 || g.Y >= 4096 || g.W < 1 || g.W > 32 || g.H < 1 || g.H > 32 || (g.X+frame(g).W)*8 > c.Dashboard.Width || g.Y+frame(g).H > 4096 {
			return fail("pane bounds")
		}
		for j := 0; j < i; j++ {
			a, b := frame(g), frame(c.Items[j].Layout)
			if overlaps(a, b) {
				return fail("panes overlap")
			}
		}
		cols, rows := g.W, g.H
		if cols < 1 || rows < 1 {
			return fail("pane too small for one app cell")
		}
		if p.Apps == nil || len(p.Apps) > MaxPlacementsPerPane {
			return fail("apps must be an array of up to 500 entries")
		}
		total += len(p.Apps)
		if total > MaxDefinitions {
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

// ConvertV3 wraps schema 3 items as one Home space. Old app IDs become definition IDs;
// placement IDs are deterministic plc-{appId}.
func ConvertV3(v3 ConfigV3) (Config, error) {
	if err := validateV3(v3); err != nil {
		return Config{}, err
	}
	homeID := "home"
	apps := make([]AppDefinition, 0)
	items := make([]Pane, 0, len(v3.Items))
	for _, p := range v3.Items {
		placements := make([]AppPlacement, 0, len(p.Apps))
		for _, a := range p.Apps {
			apps = append(apps, AppDefinition{
				ID: a.ID, Name: a.Name, URL: a.URL, Icon: a.Icon,
				OpenInNewTab: a.OpenInNewTab, Source: a.Source,
			})
			placements = append(placements, AppPlacement{
				ID: "plc-" + a.ID, AppID: a.ID, Col: a.Col, Row: a.Row,
			})
		}
		items = append(items, Pane{
			ID: p.ID, Type: "pane", Title: p.Title, Layout: p.Layout, Apps: placements,
		})
	}
	if apps == nil {
		apps = []AppDefinition{}
	}
	c := Config{
		Version:        4,
		DashboardID:    newID(),
		Dashboard:      v3.Dashboard,
		Appearance:     v3.Appearance,
		DefaultSpaceID: homeID,
		Apps:           apps,
		Spaces:         []Space{{ID: homeID, Name: "Home", Items: items}},
	}
	return c, Validate(c)
}

func decodeDocumentStrictV4(data []byte) (Config, error) {
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var c Config
	if e := d.Decode(&c); e != nil {
		return c, e
	}
	var extra any
	if e := d.Decode(&extra); e != io.EOF {
		return c, fmt.Errorf("expected one configuration document")
	}
	if c.Version != 4 {
		return c, fmt.Errorf("unsupported version (schema 4 required)")
	}
	return c, Validate(c)
}

func decodeV3Map(raw map[string]any) (ConfigV3, error) {
	b, err := json.Marshal(raw)
	if err != nil {
		return ConfigV3{}, err
	}
	var c ConfigV3
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return ConfigV3{}, err
	}
	return c, validateV3(c)
}

func peekVersion(raw map[string]any) int {
	v, ok := asInt(raw["version"])
	if !ok {
		return 0
	}
	return v
}

func decodeDocument(data []byte, format string) (Config, error) {
	var raw map[string]any
	switch format {
	case "json":
		d := json.NewDecoder(bytes.NewReader(data))
		d.DisallowUnknownFields()
		if err := d.Decode(&raw); err != nil {
			return Config{}, err
		}
		var extra any
		if err := d.Decode(&extra); err != io.EOF {
			return Config{}, fmt.Errorf("expected one configuration document")
		}
	case "yaml":
		d := yaml.NewDecoder(bytes.NewReader(data))
		d.KnownFields(true)
		if err := d.Decode(&raw); err != nil {
			return Config{}, err
		}
		var extra any
		if err := d.Decode(&extra); err != io.EOF {
			return Config{}, fmt.Errorf("expected one YAML document")
		}
	default:
		return Config{}, fmt.Errorf("unknown format")
	}
	ver := peekVersion(raw)
	if ver == 3 {
		v3, err := decodeV3Map(raw)
		if err != nil {
			return Config{}, err
		}
		return ConvertV3(v3)
	}
	if ver != 4 {
		return Config{}, fmt.Errorf("invalid configuration: unsupported version (schema 4 required)")
	}
	// Re-decode strictly into Config so unknown fields are rejected against the struct.
	b, err := json.Marshal(raw)
	if err != nil {
		return Config{}, err
	}
	var c Config
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return Config{}, err
	}
	return c, Validate(c)
}
