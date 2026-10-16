package config

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

type Glass struct {
	Mode         string `json:"mode" yaml:"mode"`
	Opacity      int    `json:"opacity" yaml:"opacity"`
	Blur         int    `json:"blur" yaml:"blur"`
	Displacement int    `json:"displacement,omitempty" yaml:"displacement,omitempty"`
	Aberration   int    `json:"aberration,omitempty" yaml:"aberration,omitempty"`
	Saturation   int    `json:"saturation,omitempty" yaml:"saturation,omitempty"`
}
type Palette struct {
	Background string `json:"background" yaml:"background"`
	Surface    string `json:"surface" yaml:"surface"`
	Text       string `json:"text" yaml:"text"`
	Accent     string `json:"accent" yaml:"accent"`
}

var hexColour = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func luminance(s string) float64 {
	n, _ := strconv.ParseUint(s[1:], 16, 32)
	out := 0.0
	for i, weight := range []float64{0.2126, 0.7152, 0.0722} {
		v := float64((n>>uint(16-i*8))&255) / 255
		if v <= 0.04045 {
			v /= 12.92
		} else {
			v = math.Pow((v+0.055)/1.055, 2.4)
		}
		out += v * weight
	}
	return out
}
func contrast(a, b string) float64 {
	x, y := luminance(a), luminance(b)
	return (math.Max(x, y) + 0.05) / (math.Min(x, y) + 0.05)
}

// validLogo accepts empty, HTTP(S) image URLs, or same-origin media asset paths.
// Embedded data URIs are rejected (Path A / schema 3).
func validLogo(s string) bool {
	if s == "" {
		return true
	}
	if strings.HasPrefix(s, "/media/assets/") {
		return ValidMediaID(strings.TrimPrefix(s, "/media/assets/"))
	}
	if strings.HasPrefix(s, "/media/staging/") {
		return ValidMediaID(strings.TrimPrefix(s, "/media/staging/"))
	}
	return validURL(s, false)
}

// Builtin header icon ids — keep in sync with web/src/brandIcons.tsx.
var builtinHeaderIcons = []string{
	"", "grid", "server", "panels", "house", "dashboard", "boxes", "cloud",
	"database", "drive", "monitor", "rocket", "settings", "shield", "sparkles",
	"star", "terminal", "wifi", "zap",
}

func validateAppearance(c Config) error {
	if !slices.Contains(builtinHeaderIcons, c.Dashboard.BuiltinIcon) ||
		!validLogo(c.Dashboard.Logo) || !validLogo(c.Dashboard.Icon) {
		return fmt.Errorf("invalid header branding or image")
	}
	if b := c.Appearance.Background; b != nil {
		if err := validateBackground(b); err != nil {
			return err
		}
	}
	if g := c.Appearance.Glass; g != nil {
		// Previous files stored the effect units: displacement 0–150, saturation as CSS percent 0–200.
		if g.Displacement > 100 && g.Displacement <= 150 {
			g.Displacement = int(math.Round(float64(g.Displacement) / 1.5))
		}
		if g.Saturation > 100 && g.Saturation <= 200 {
			g.Saturation = int(math.Round(float64(g.Saturation) / 2))
		}
		if !slices.Contains([]string{"solid", "glass"}, g.Mode) || g.Opacity < 0 || g.Opacity > 100 || g.Blur < 0 || g.Blur > 24 {
			return fmt.Errorf("invalid global glass settings")
		}
		if g.Displacement < 0 || g.Displacement > 100 || g.Aberration < 0 || g.Aberration > 100 ||
			g.Saturation < 0 || g.Saturation > 100 {
			return fmt.Errorf("invalid global glass settings")
		}
	}
	if p := c.Appearance.Palette; p != nil {
		for _, v := range []string{p.Background, p.Surface, p.Text, p.Accent} {
			if !hexColour.MatchString(v) {
				return fmt.Errorf("colours must be six-digit hex values")
			}
		}
		if contrast(p.Text, p.Surface) < 4.5 || contrast(p.Text, p.Background) < 4.5 {
			return fmt.Errorf("text needs at least 4.5:1 contrast against the page and pane colours")
		}
	}
	return nil
}
