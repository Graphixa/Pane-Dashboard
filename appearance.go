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
	"strconv"
	"strings"
)

const configLimit = 8 << 20
const imageLimit = 2 << 20

type Background struct {
	Kind      string `json:"kind" yaml:"kind"`
	Preset    string `json:"preset" yaml:"preset"`
	Image     string `json:"image" yaml:"image"`
	Dimming   int    `json:"dimming" yaml:"dimming"`
	Position  string `json:"position" yaml:"position"`
	Motion    bool   `json:"motion" yaml:"motion"`
	Intensity int    `json:"intensity" yaml:"intensity"`
}
type Glass struct {
	Mode    string `json:"mode" yaml:"mode"`
	Opacity int    `json:"opacity" yaml:"opacity"`
	Blur    int    `json:"blur" yaml:"blur"`
}
type Palette struct {
	Background string `json:"background" yaml:"background"`
	Surface    string `json:"surface" yaml:"surface"`
	Text       string `json:"text" yaml:"text"`
	Accent     string `json:"accent" yaml:"accent"`
}

func oneOf(s string, values ...string) bool {
	for _, v := range values {
		if s == v {
			return true
		}
	}
	return false
}
func decodeImage(data []byte) (image.Config, string, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || !oneOf(format, "png", "jpeg") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 4096 || cfg.Height > 4096 || int64(cfg.Width)*int64(cfg.Height) > 4_000_000 {
		return cfg, format, fmt.Errorf("use a PNG or JPEG image, at most 4 million pixels and 4096 px per side")
	}
	return cfg, format, nil
}
func validImage(s string) bool {
	if !strings.HasPrefix(s, "data:") {
		return validURL(s, true)
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) != 2 || !oneOf(parts[0], "data:image/png;base64", "data:image/jpeg;base64") || len(parts[1]) > base64.StdEncoding.EncodedLen(imageLimit) {
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
	if !oneOf(c.Dashboard.Branding, "", "icon", "logo") || !oneOf(c.Dashboard.BuiltinIcon, "", "grid", "server", "panels") || !validImage(c.Dashboard.Logo) {
		return fmt.Errorf("invalid header branding or image")
	}
	if b := c.Appearance.Background; b != nil {
		if !oneOf(b.Kind, "none", "gradient", "image", "waves", "aurora") || !oneOf(b.Preset, "dusk", "ocean", "forest", "mist") || !oneOf(b.Position, "center", "top", "bottom") || b.Dimming < 0 || b.Dimming > 80 || b.Intensity < 0 || b.Intensity > 100 || !validImage(b.Image) || (b.Kind == "image" && b.Image == "") {
			return fmt.Errorf("invalid background settings or image")
		}
	}
	if g := c.Appearance.Glass; g != nil {
		if !oneOf(g.Mode, "solid", "glass") || g.Opacity < 30 || g.Opacity > 100 || g.Blur < 0 || g.Blur > 24 {
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
	_, format, err := decodeImage(data)
	if err != nil {
		apiError(w, 400, err.Error())
		return
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		apiError(w, 400, "Image is damaged or unsupported")
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
