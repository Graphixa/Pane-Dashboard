package config

import (
	"fmt"
	"net/url"
	"strings"
)

// Schema 3 media references and background composition.
// Path A: this is the only supported background shape (no legacy migration).

const mediaLibraryMaxEntries = 24

type MediaRef struct {
	Source    string `json:"source" yaml:"source"` // asset | builtin | url
	AssetID   string `json:"assetId,omitempty" yaml:"assetId,omitempty"`
	BuiltinID string `json:"builtinId,omitempty" yaml:"builtinId,omitempty"`
	URL       string `json:"url,omitempty" yaml:"url,omitempty"`
}

type Wallpaper struct {
	Kind     string    `json:"kind" yaml:"kind"` // none | solid | gradient | image | video
	Colour   string    `json:"colour,omitempty" yaml:"colour,omitempty"`
	Preset   string    `json:"preset,omitempty" yaml:"preset,omitempty"`
	Media    *MediaRef `json:"media,omitempty" yaml:"media,omitempty"`
	Position string    `json:"position,omitempty" yaml:"position,omitempty"`
	Playback string    `json:"playback,omitempty" yaml:"playback,omitempty"` // loop | static
}

type PhotoMotion struct {
	Style     string `json:"style" yaml:"style"`
	Intensity int    `json:"intensity" yaml:"intensity"`
}

type Effect struct {
	ID     string         `json:"id" yaml:"id"`
	Params map[string]any `json:"params,omitempty" yaml:"params,omitempty"`
}

type CreativeTint struct {
	Colour  string `json:"colour" yaml:"colour"`
	Opacity int    `json:"opacity" yaml:"opacity"`
}

type Background struct {
	Wallpaper           Wallpaper     `json:"wallpaper" yaml:"wallpaper"`
	Library             []MediaRef    `json:"library" yaml:"library"`
	PhotoMotion         PhotoMotion   `json:"photoMotion" yaml:"photoMotion"`
	Effect              *Effect       `json:"effect,omitempty" yaml:"effect,omitempty"`
	Tint                *CreativeTint `json:"tint,omitempty" yaml:"tint,omitempty"`
	ThemeOverlayOpacity int           `json:"themeOverlayOpacity" yaml:"themeOverlayOpacity"`
}

var effectIDs = []string{"snow", "fireflies", "shooting-stars"}
var motionStylesV3 = []string{"none", "ken-burns", "breathe", "drift", "twist"}
var wallpaperKinds = []string{"none", "solid", "gradient", "image", "video"}
var gradientPresets = []string{"dusk", "ocean", "forest", "mist"}

func DefaultBackground() Background {
	return Background{
		Wallpaper:           Wallpaper{Kind: "none"},
		Library:             []MediaRef{},
		PhotoMotion:         PhotoMotion{Style: "none", Intensity: 40},
		ThemeOverlayOpacity: 25,
	}
}

// ValidMediaID reports whether an id is a safe media reference token. config and
// media keep independent copies to avoid an import cycle (config must not import
// media, media must not import config).
func ValidMediaID(id string) bool {
	if id == "" || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			continue
		}
		return false
	}
	return !strings.Contains(id, "..") && !strings.ContainsAny(id, `/\`)
}

func (r MediaRef) Validate() error {
	switch r.Source {
	case "asset":
		if !ValidMediaID(r.AssetID) || r.BuiltinID != "" || r.URL != "" {
			return fmt.Errorf("invalid asset media reference")
		}
	case "builtin":
		if r.BuiltinID == "" || len(r.BuiltinID) > 128 || strings.Contains(r.BuiltinID, "..") ||
			r.AssetID != "" || r.URL != "" || !strings.Contains(r.BuiltinID, "@v") {
			return fmt.Errorf("invalid builtin media reference")
		}
	case "url":
		if r.AssetID != "" || r.BuiltinID != "" || !validRemoteImageURL(r.URL) {
			return fmt.Errorf("invalid url media reference")
		}
	default:
		return fmt.Errorf("unknown media source")
	}
	return nil
}

func validRemoteImageURL(s string) bool {
	if s == "" || len(s) > 2048 {
		return false
	}
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" && u.User == nil
}

func (r MediaRef) AssetRef() (string, bool) {
	if r.Source == "asset" && ValidMediaID(r.AssetID) {
		return r.AssetID, true
	}
	return "", false
}

// CollectAssetIDs returns the set of durable asset IDs referenced by a
// background and the optional logo.
func CollectAssetIDs(b Background, logo string) map[string]struct{} {
	out := map[string]struct{}{}
	add := func(r MediaRef) {
		if id, ok := r.AssetRef(); ok {
			out[id] = struct{}{}
		}
	}
	if b.Wallpaper.Media != nil {
		add(*b.Wallpaper.Media)
	}
	for _, r := range b.Library {
		add(r)
	}
	if id, ok := LogoAssetID(logo); ok {
		out[id] = struct{}{}
	}
	return out
}

func LogoAssetID(logo string) (string, bool) {
	const prefix = "/media/assets/"
	if strings.HasPrefix(logo, prefix) {
		id := strings.TrimPrefix(logo, prefix)
		if ValidMediaID(id) {
			return id, true
		}
	}
	return "", false
}

func validateBackground(b *Background) error {
	if b == nil {
		return nil
	}
	if b.Library == nil {
		b.Library = []MediaRef{}
	}
	if len(b.Library) > mediaLibraryMaxEntries {
		return fmt.Errorf("media library is full (maximum %d items)", mediaLibraryMaxEntries)
	}
	if b.ThemeOverlayOpacity < 0 || b.ThemeOverlayOpacity > 80 {
		return fmt.Errorf("theme overlay opacity must be 0–80")
	}
	if !containsStr(motionStylesV3, b.PhotoMotion.Style) || b.PhotoMotion.Intensity < 0 || b.PhotoMotion.Intensity > 100 {
		return fmt.Errorf("invalid photo motion")
	}
	if !containsStr(wallpaperKinds, b.Wallpaper.Kind) {
		return fmt.Errorf("invalid wallpaper kind")
	}
	switch b.Wallpaper.Kind {
	case "none":
		b.Wallpaper.Media = nil
		b.Wallpaper.Colour = ""
		b.Wallpaper.Preset = ""
		b.Wallpaper.Position = ""
		b.Wallpaper.Playback = ""
	case "solid":
		if b.Wallpaper.Colour == "" {
			b.Wallpaper.Colour = "#a2cbbb"
		}
		if !hexColour.MatchString(b.Wallpaper.Colour) {
			return fmt.Errorf("invalid solid colour")
		}
		b.Wallpaper.Media = nil
		b.Wallpaper.Preset = ""
		b.Wallpaper.Position = ""
		b.Wallpaper.Playback = ""
	case "gradient":
		if !containsStr(gradientPresets, b.Wallpaper.Preset) {
			return fmt.Errorf("invalid gradient preset")
		}
		b.Wallpaper.Media = nil
		b.Wallpaper.Playback = ""
	case "image", "video":
		if b.Wallpaper.Media == nil {
			return fmt.Errorf("wallpaper media required")
		}
		if err := b.Wallpaper.Media.Validate(); err != nil {
			return err
		}
		if b.Wallpaper.Position == "" {
			b.Wallpaper.Position = "center"
		}
		if !containsStr([]string{"center", "top", "bottom"}, b.Wallpaper.Position) {
			return fmt.Errorf("invalid position")
		}
		if b.Wallpaper.Kind == "video" {
			if b.Wallpaper.Playback == "" {
				b.Wallpaper.Playback = "loop"
			}
			if !containsStr([]string{"loop", "static"}, b.Wallpaper.Playback) {
				return fmt.Errorf("invalid video playback preference")
			}
			if b.Wallpaper.Media.Source == "url" {
				return fmt.Errorf("remote video URLs are not supported")
			}
		} else {
			b.Wallpaper.Playback = ""
		}
		if b.Wallpaper.Media.Source != "builtin" && !libraryContains(b.Library, *b.Wallpaper.Media) {
			return fmt.Errorf("active wallpaper must be present in the media library")
		}
	}
	for i, r := range b.Library {
		if err := r.Validate(); err != nil {
			return fmt.Errorf("library[%d]: %w", i, err)
		}
	}
	if b.Effect != nil {
		if !containsStr(effectIDs, b.Effect.ID) {
			return fmt.Errorf("invalid effect")
		}
		if b.Effect.Params == nil {
			b.Effect.Params = map[string]any{}
		}
		if len(b.Effect.Params) > 32 {
			return fmt.Errorf("invalid effect parameters")
		}
	}
	if b.Tint != nil {
		if !hexColour.MatchString(b.Tint.Colour) || b.Tint.Opacity < 0 || b.Tint.Opacity > 80 {
			return fmt.Errorf("invalid creative tint")
		}
	}
	return nil
}

func libraryContains(lib []MediaRef, r MediaRef) bool {
	for _, x := range lib {
		if mediaRefEqual(x, r) {
			return true
		}
	}
	return false
}

func mediaRefEqual(a, b MediaRef) bool {
	return a.Source == b.Source && a.AssetID == b.AssetID && a.BuiltinID == b.BuiltinID && a.URL == b.URL
}

func containsStr(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func mediaURL(r MediaRef) string {
	switch r.Source {
	case "asset":
		return "/media/assets/" + r.AssetID
	case "builtin":
		return "/media/builtin/" + r.BuiltinID
	case "url":
		return r.URL
	default:
		return ""
	}
}
