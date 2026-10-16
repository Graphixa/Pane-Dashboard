// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  defaultBackground,
  logoReference,
  maxLibraryEntries,
  mediaSrc,
  normaliseBackground,
  prependLibrary,
  remoteImageURL,
  themeOverlayPaint,
  type Background,
  type MediaRef,
} from "./appearance";
import BackgroundScene from "./Background";
import { Config, validate } from "./model";

const base: Config = {
  version: 3,
  dashboard: { title: "pane.", widthMode: "fixed", width: 960 },
  appearance: {
    showAppLabels: true,
    showButtonLabels: true,
    theme: "dark",
  },
  items: [],
};

describe("schema 3 background media", () => {
  it("normalises defaults and theme overlay paint", () => {
    const b = normaliseBackground(undefined);
    expect(b.wallpaper.kind).toBe("none");
    expect(b.themeOverlayOpacity).toBe(25);
    expect(themeOverlayPaint("light", 25)).toContain("255,255,255");
    expect(themeOverlayPaint("dark", 0)).toBe("transparent");
  });

  it("accepts media refs and rejects unsafe logos", () => {
    expect(remoteImageURL("https://example.com/a.png")).toBe(true);
    expect(remoteImageURL("javascript:alert(1)")).toBe(false);
    expect(logoReference("")).toBe(true);
    expect(logoReference("/media/assets/abcdef0123456789")).toBe(true);
    expect(logoReference("data:image/png;base64,xx")).toBe(false);
  });

  it("drops retired scene ids and keeps library bounded", () => {
    expect(
      normaliseBackground({
        effect: { id: "aurora" as never, params: {} },
      }).effect,
    ).toBeUndefined();
    const ref: MediaRef = { source: "url", url: "https://example.com/a.png" };
    let lib: MediaRef[] = [];
    for (let i = 0; i < maxLibraryEntries; i++) {
      lib = prependLibrary(lib, {
        source: "url",
        url: `https://example.com/${i}.png`,
      });
    }
    expect(() => prependLibrary(lib, ref)).toThrow(/full/);
  });

  it("validates a schema 3 config with image wallpaper", () => {
    const ref: MediaRef = {
      source: "url",
      url: "https://example.com/wall.png",
    };
    const c: Config = {
      ...base,
      appearance: {
        ...base.appearance,
        background: {
          wallpaper: { kind: "image", media: ref, position: "center" },
          library: [ref],
          photoMotion: { style: "ken-burns", intensity: 40 },
          themeOverlayOpacity: 20,
          effect: { id: "snow", params: { seed: "#ffffff", speed: 40 } },
          tint: { colour: "#112233", opacity: 10 },
        },
      },
    };
    expect(() => validate(c)).not.toThrow();
  });

  it("renders composition layers without dynamic scenes", async () => {
    const ref: MediaRef = {
      source: "url",
      url: "https://example.com/wall.png",
    };
    const settings: Background = {
      wallpaper: { kind: "image", media: ref, position: "center" },
      library: [ref],
      photoMotion: { style: "none", intensity: 40 },
      themeOverlayOpacity: 25,
      effect: { id: "fireflies", params: {} },
      tint: { colour: "#ff8800", opacity: 15 },
    };
    const { container } = render(
      <BackgroundScene settings={settings} theme="dark" />,
    );
    expect(container.querySelector(".scene-photo-host")).toBeTruthy();
    expect(container.querySelector(".scene-tint")).toBeTruthy();
    const effect = container.querySelector(".scene-effect");
    expect(effect).toBeTruthy();
    expect(effect?.getAttribute("data-effect-id")).toBe("fireflies");
    await waitFor(() => {
      expect(effect?.querySelector(".fly")).toBeTruthy();
    });
    expect(document.getElementById("pane-effect-style-fireflies")?.textContent).toContain(
      "pane-fx-fireflies-fly-drift",
    );
    expect(container.querySelector(".scene-theme-overlay")).toBeTruthy();
    expect(container.querySelector(".scene-dynamic")).toBeNull();
    expect(mediaSrc(ref)).toBe("https://example.com/wall.png");
  });

  it("honours reduced motion for photo transforms", () => {
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMedia,
    });
    const ref: MediaRef = {
      source: "url",
      url: "https://example.com/wall.png",
    };
    const { container } = render(
      <BackgroundScene
        settings={{
          wallpaper: { kind: "image", media: ref, position: "center" },
          library: [ref],
          photoMotion: { style: "ken-burns", intensity: 50 },
          themeOverlayOpacity: 0,
        }}
        theme="dark"
      />,
    );
    expect(container.querySelector(".scene")?.className).toContain(
      "motion-paused",
    );
  });
});
