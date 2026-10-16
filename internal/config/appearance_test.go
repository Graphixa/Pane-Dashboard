package config

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestLogoRejectsDataURI(t *testing.T) {
	if validLogo("data:image/png;base64,aaaa") {
		t.Fatal("data URI logo accepted")
	}
	if !validLogo("") || !validLogo("https://example.com/logo.png") {
		t.Fatal("valid logos rejected")
	}
	if !validLogo("/media/assets/abcdef0123456789abcdef0123456789") {
		t.Fatal("asset path rejected")
	}
}

func TestGlobalAppearanceValidation(t *testing.T) {
	for _, mutate := range []func(*Config){
		func(c *Config) { c.Dashboard.Branding = "anything" },
		func(c *Config) { c.Dashboard.BuiltinIcon = "anything" },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: -1, Blur: 12} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 70, Blur: 25} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Displacement: 151} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Saturation: 201} },
		func(c *Config) { c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 50, Blur: 12, Aberration: 101} },
		func(c *Config) {
			bg := DefaultBackground()
			bg.Wallpaper = Wallpaper{Kind: "image", Position: "center"}
			c.Appearance.Background = &bg
		},
		func(c *Config) {
			c.Appearance.Palette = &Palette{Background: "#111111", Surface: "#111111", Text: "#121212", Accent: "#ff0000"}
		},
		func(c *Config) {
			c.Appearance.Palette = &Palette{Background: "url(test)", Surface: "#111111", Text: "#ffffff", Accent: "#ff0000"}
		},
	} {
		c := DefaultConfig()
		mutate(&c)
		if Validate(c) == nil {
			t.Fatal("invalid appearance accepted")
		}
	}
	c := populated()
	b, _ := json.Marshal(c)
	b = bytes.Replace(b, []byte(`"type":"pane"`), []byte(`"type":"pane","glass":{"mode":"glass"}`), 1)
	if _, err := DecodeJSON(b); err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatal("per-pane appearance override accepted", err)
	}
}

func TestLegacyGlassUnits(t *testing.T) {
	c := DefaultConfig()
	c.Appearance.Glass = &Glass{Mode: "glass", Opacity: 0, Blur: 2, Displacement: 150, Saturation: 157, Aberration: 3}
	if err := Validate(c); err != nil {
		t.Fatal(err)
	}
	if c.Appearance.Glass.Displacement != 100 || c.Appearance.Glass.Saturation != 79 {
		t.Fatalf("%+v", c.Appearance.Glass)
	}
}

func TestBackgroundEffectAndTint(t *testing.T) {
	c := DefaultConfig()
	bg := DefaultBackground()
	bg.Wallpaper = Wallpaper{Kind: "gradient", Preset: "dusk"}
	bg.Effect = &Effect{ID: "snow", Params: map[string]any{"speed": 40}}
	bg.Tint = &CreativeTint{Colour: "#ff8800", Opacity: 20}
	bg.ThemeOverlayOpacity = 10
	c.Appearance.Background = &bg
	if err := Validate(c); err != nil {
		t.Fatal(err)
	}
	bg.Effect.ID = "aurora"
	c.Appearance.Background = &bg
	if Validate(c) == nil {
		t.Fatal("full-scene effect id accepted")
	}
}
