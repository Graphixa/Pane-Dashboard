package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"math"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

const configLimit = 8 << 20
const imageLimit = 2 << 20

type Background struct {
	Kind           string `json:"kind" yaml:"kind"`
	Preset         string `json:"preset" yaml:"preset"`
	Image          string `json:"image" yaml:"image"`
	Dimming        int    `json:"dimming,omitempty" yaml:"dimming,omitempty"`
	Overlay        string `json:"overlay,omitempty" yaml:"overlay,omitempty"`
	OverlayOpacity int    `json:"overlayOpacity,omitempty" yaml:"overlayOpacity,omitempty"`
	OverlayColour  string `json:"overlayColour,omitempty" yaml:"overlayColour,omitempty"`
	Position       string `json:"position" yaml:"position"`
	Motion         bool   `json:"motion" yaml:"motion"`
	MotionStyle    string `json:"motionStyle,omitempty" yaml:"motionStyle,omitempty"`
	Intensity      int    `json:"intensity" yaml:"intensity"`
}
type Glass struct {
	Mode         string `json:"mode" yaml:"mode"`
	Opacity      int    `json:"opacity" yaml:"opacity"`
	Blur         int    `json:"blur" yaml:"blur"`
	Displacement int    `json:"displacement,omitempty" yaml:"displacement,omitempty"`
	Aberration   int    `json:"aberration,omitempty" yaml:"aberration,omitempty"`
	Saturation   int    `json:"saturation,omitempty" yaml:"saturation,omitempty"`
	Elasticity   int    `json:"elasticity,omitempty" yaml:"elasticity,omitempty"`
}
type Palette struct {
	Background string `json:"background" yaml:"background"`
	Surface    string `json:"surface" yaml:"surface"`
	Text       string `json:"text" yaml:"text"`
	Accent     string `json:"accent" yaml:"accent"`
}

func imageBoundsOK(w, h int, format string) bool {
	return slices.Contains([]string{"png", "jpeg"}, format) && w >= 1 && h >= 1 && w <= 4096 && h <= 4096 && int64(w)*int64(h) <= 4_000_000
}
func decodeImage(data []byte) (image.Config, string, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || !imageBoundsOK(cfg.Width, cfg.Height, format) {
		return cfg, format, fmt.Errorf("use a PNG or JPEG image, at most 4 million pixels and 4096 px per side")
	}
	return cfg, format, nil
}
func validImage(s string) bool {
	if !strings.HasPrefix(s, "data:") {
		return validURL(s, true)
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) != 2 || !slices.Contains([]string{"data:image/png;base64", "data:image/jpeg;base64"}, parts[0]) || len(parts[1]) > base64.StdEncoding.EncodedLen(imageLimit) {
		return false
	}
	data, err := base64.StdEncoding.Strict().DecodeString(parts[1])
	if err != nil || len(data) > imageLimit {
		return false
	}
	_, format, err := decodeImage(data)
	return err == nil && parts[0] == "data:image/"+format+";base64"
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
func validateAppearance(c Config) error {
	if !slices.Contains([]string{"", "icon", "logo"}, c.Dashboard.Branding) || !slices.Contains([]string{"", "grid", "server", "panels"}, c.Dashboard.BuiltinIcon) || !validImage(c.Dashboard.Logo) {
		return fmt.Errorf("invalid header branding or image")
	}
	if b := c.Appearance.Background; b != nil {
		if !slices.Contains([]string{"none", "gradient", "image", "waves", "aurora"}, b.Kind) || !slices.Contains([]string{"dusk", "ocean", "forest", "mist"}, b.Preset) || !slices.Contains([]string{"center", "top", "bottom"}, b.Position) || b.Intensity < 0 || b.Intensity > 100 || !validImage(b.Image) || (b.Kind == "image" && b.Image == "") || (b.MotionStyle != "" && !slices.Contains([]string{"none", "ken-burns", "breathe", "drift", "twist"}, b.MotionStyle)) {
			return fmt.Errorf("invalid background settings or image")
		}
		if b.Overlay == "" {
			if b.Dimming < 0 || b.Dimming > 80 {
				return fmt.Errorf("invalid background settings or image")
			}
			if c.Appearance.Theme == "light" {
				b.Overlay, b.OverlayColour = "light-solid", "#f5f6f2"
			} else {
				b.Overlay, b.OverlayColour = "dark-solid", "#111720"
			}
			b.OverlayOpacity = b.Dimming
			b.Dimming = 0
		}
		if !slices.Contains([]string{"dark-solid", "dark-gradient", "light-solid", "light-gradient", "custom"}, b.Overlay) || b.OverlayOpacity < 0 || b.OverlayOpacity > 80 || !hexColour.MatchString(b.OverlayColour) {
			return fmt.Errorf("invalid background overlay settings")
		}
	}
	if g := c.Appearance.Glass; g != nil {
		if !slices.Contains([]string{"solid", "glass"}, g.Mode) || g.Opacity < 0 || g.Opacity > 100 || g.Blur < 0 || g.Blur > 24 {
			return fmt.Errorf("invalid global glass settings")
		}
		if g.Displacement < 0 || g.Displacement > 150 || g.Aberration < 0 || g.Aberration > 5 || g.Elasticity < 0 || g.Elasticity > 100 {
			return fmt.Errorf("invalid global glass settings")
		}
		if g.Saturation != 0 && (g.Saturation < 100 || g.Saturation > 200) {
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

// Preparation does not persist anything: Apply saves the returned image with the
// configuration, so cancelling needs no cleanup and backups remain self-contained.
func prepareImage(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 5<<20))
	if err != nil {
		apiError(w, 413, "Image exceeds 5 MiB")
		return
	}
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		apiError(w, 400, "Image is damaged or unsupported")
		return
	}
	b := img.Bounds()
	wPx, hPx := b.Dx(), b.Dy()
	if !imageBoundsOK(wPx, hPx, format) {
		apiError(w, 400, "use a PNG or JPEG image, at most 4 million pixels and 4096 px per side")
		return
	}
	var out bytes.Buffer
	if format == "png" {
		err = png.Encode(&out, img)
	} else {
		err = jpeg.Encode(&out, img, &jpeg.Options{Quality: 88})
	}
	if err != nil || out.Len() > imageLimit {
		apiError(w, 413, "Prepared image exceeds 2 MiB; choose a smaller image")
		return
	}
	respond(w, 200, map[string]string{"image": "data:image/" + format + ";base64," + base64.StdEncoding.EncodeToString(out.Bytes())})
}
