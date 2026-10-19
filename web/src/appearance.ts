import type { CSSProperties } from "react";
import { fail } from "./validation";

export type MediaRef =
  | { source: "asset"; assetId: string }
  | { source: "builtin"; builtinId: string }
  | { source: "url"; url: string };

export type Wallpaper =
  | { kind: "none" }
  | { kind: "solid"; colour: string }
  | { kind: "gradient"; preset: "dusk" | "ocean" | "forest" | "mist" }
  | {
      kind: "image";
      media: MediaRef;
      position: "center" | "top" | "bottom";
    }
  | {
      kind: "video";
      media: MediaRef;
      position: "center" | "top" | "bottom";
      playback: "loop" | "static";
    };

export const motionStyles = [
  "none",
  "ken-burns",
  "breathe",
  "drift",
  "twist",
] as const;
export type MotionStyle = (typeof motionStyles)[number];
export const motionStyleLabels: Record<MotionStyle, string> = {
  none: "None",
  "ken-burns": "Ken Burns",
  breathe: "Breathe",
  drift: "Drift",
  twist: "Twist",
};

export type PhotoMotion = {
  style: MotionStyle;
  intensity: number;
};

export const effectIds = ["snow", "fireflies", "shooting-stars"] as const;
export type EffectId = (typeof effectIds)[number];
export const effectLabels: Record<EffectId, string> = {
  snow: "Snow",
  fireflies: "Fireflies",
  "shooting-stars": "Shooting stars",
};

export type Effect = {
  id: EffectId;
  params: Record<string, string | number | boolean>;
};

export type CreativeTint = {
  colour: string;
  opacity: number;
};

export type Background = {
  wallpaper: Wallpaper;
  library: MediaRef[];
  photoMotion: PhotoMotion;
  effect?: Effect;
  tint?: CreativeTint;
  themeOverlayOpacity: number;
};

/** Explicit reject when full — no silent eviction. */
export const maxLibraryEntries = 24;

export type Glass = {
  mode: "solid" | "glass";
  opacity: number;
  blur: number;
  displacement: number;
  aberration: number;
  saturation: number;
};
export type Palette = {
  background: string;
  surface: string;
  text: string;
  accent: string;
};
export type UiFont = "geist" | "rubik" | "oxanium";
export type AppearanceOptions = {
  theme: "dark" | "light";
  fontFamily?: UiFont;
  background?: Background;
  glass?: Partial<Glass> & Pick<Glass, "mode" | "opacity" | "blur">;
  palette?: Palette;
};
export const uiFonts: { id: UiFont; label: string; family: string }[] = [
  { id: "geist", label: "Geist", family: "Geist" },
  { id: "rubik", label: "Rubik", family: "Rubik" },
  { id: "oxanium", label: "Oxanium", family: "Oxanium" },
];
export const defaultUiFont: UiFont = "geist";
export function uiFontFamily(id?: UiFont) {
  return uiFonts.find((f) => f.id === resolveUiFont(id))?.family ?? "Geist";
}
export function resolveUiFont(value: unknown): UiFont {
  if (
    typeof value === "string" &&
    value !== "" &&
    uiFonts.some((f) => f.id === value)
  )
    return value as UiFont;
  return defaultUiFont;
}
export function normaliseAppearanceFont<T extends { fontFamily?: UiFont }>(
  appearance: T,
): T {
  const { fontFamily, ...rest } = appearance;
  if (fontFamily === undefined) return appearance;
  if (uiFonts.some((f) => f.id === (fontFamily as string))) return appearance;
  return rest as T;
}

export const defaultBackground: Background = {
  wallpaper: { kind: "none" },
  library: [],
  photoMotion: { style: "none", intensity: 40 },
  themeOverlayOpacity: 25,
};

export function motionDurationSeconds(intensity: number) {
  const n = Number.isFinite(intensity)
    ? Math.min(100, Math.max(0, intensity))
    : 40;
  return Math.round((80 - n * 0.74) * 10) / 10;
}
export function parseIntegerInput(raw: string, min: number, max: number) {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}
export function withMotionStyle(style: MotionStyle): PhotoMotion {
  return {
    style,
    intensity: style === "none" ? 40 : 40,
  };
}

export const defaultGlass: Glass = {
  mode: "solid",
  opacity: 15,
  blur: 2,
  displacement: 100,
  aberration: 60,
  saturation: 75,
};
export function glassSaturationCss(saturation: number) {
  return Math.round(Math.min(100, Math.max(0, saturation)) * 2);
}
export function glassDisplacementScale(displacement: number) {
  return Math.round(Math.min(100, Math.max(0, displacement)) * 1.5);
}
export function glassAberrationUnits(aberration: number) {
  return Math.min(100, Math.max(0, aberration)) / 20;
}
function foldLegacyGlass(
  value: number | undefined,
  divisor: number,
  legacyMax: number,
  fallback: number,
) {
  if (value === undefined) return fallback;
  if (value > 100 && value <= legacyMax) return Math.round(value / divisor);
  return value;
}
export function normaliseGlass(
  g: Partial<Glass> & Pick<Glass, "mode" | "opacity" | "blur">,
): Glass {
  return {
    mode: g.mode,
    opacity: g.opacity,
    blur: g.blur,
    displacement: foldLegacyGlass(
      g.displacement,
      1.5,
      150,
      defaultGlass.displacement,
    ),
    aberration: g.aberration ?? defaultGlass.aberration,
    saturation: foldLegacyGlass(
      g.saturation,
      2,
      200,
      defaultGlass.saturation,
    ),
  };
}
export const palettes: Record<"dark" | "light", Palette> = {
  dark: {
    background: "#111720",
    surface: "#1a222e",
    text: "#e9eef7",
    accent: "#a2cbbb",
  },
  light: {
    background: "#f5f6f2",
    surface: "#ffffff",
    text: "#172b26",
    accent: "#287962",
  },
};
export const accentPresets: Record<
  "dark" | "light",
  { name: string; colour: string }[]
> = {
  dark: [
    { name: "Mint", colour: palettes.dark.accent },
    { name: "Blue", colour: "#7db7ff" },
    { name: "Violet", colour: "#bca5ff" },
    { name: "Rose", colour: "#ef9fb5" },
    { name: "Amber", colour: "#efc06e" },
    { name: "Teal", colour: "#72d4cc" },
  ],
  light: [
    { name: "Mint", colour: palettes.light.accent },
    { name: "Blue", colour: "#1d4f91" },
    { name: "Violet", colour: "#5b3cc4" },
    { name: "Rose", colour: "#b4235a" },
    { name: "Amber", colour: "#b45309" },
    { name: "Teal", colour: "#0f766e" },
  ],
};
export function accentPresetName(
  theme: "dark" | "light",
  accent: string,
): string | undefined {
  const colour = accent.toLowerCase();
  return accentPresets[theme].find((p) => p.colour.toLowerCase() === colour)
    ?.name;
}
export function paletteForThemeChange(
  from: "dark" | "light",
  to: "dark" | "light",
  palette?: Palette,
): Palette | undefined {
  if (!palette || from === to) return palette;
  const base = palettes[from];
  const touched =
    palette.background.toLowerCase() !== base.background.toLowerCase() ||
    palette.surface.toLowerCase() !== base.surface.toLowerCase() ||
    palette.text.toLowerCase() !== base.text.toLowerCase();
  if (touched) return undefined;
  const name = accentPresetName(from, palette.accent);
  if (!name || name === "Mint") return undefined;
  const colour = accentPresets[to].find((p) => p.name === name)!.colour;
  return { ...palettes[to], accent: colour };
}
export const gradients = {
  dusk: "radial-gradient(ellipse at 15% 10%, #765586, transparent 60%), linear-gradient(130deg, #172331, #493653)",
  ocean:
    "radial-gradient(ellipse at 80% 20%, #237b87, transparent 60%), linear-gradient(140deg, #14273c, #203d67)",
  forest:
    "radial-gradient(ellipse at 20% 80%, #497453, transparent 60%), linear-gradient(135deg, #182b2d, #243c34)",
  mist: "radial-gradient(ellipse at 80% 20%, #e0dcd5, transparent 60%), linear-gradient(135deg, #a8b5bb, #7c8c9d)",
};

export const SOLID_TINT_PERCENT = 28;
export function solidBackgroundPaint(colour: string): string {
  const hex =
    typeof colour === "string" && /^#[a-fA-F0-9]{6}$/.test(colour)
      ? colour.toLowerCase()
      : "#a2cbbb";
  return `color-mix(in srgb, ${hex} ${SOLID_TINT_PERCENT}%, var(--bg))`;
}

export function mediaRefEqual(a: MediaRef, b: MediaRef): boolean {
  if (a.source !== b.source) return false;
  if (a.source === "asset" && b.source === "asset")
    return a.assetId === b.assetId;
  if (a.source === "builtin" && b.source === "builtin")
    return a.builtinId === b.builtinId;
  if (a.source === "url" && b.source === "url") return a.url === b.url;
  return false;
}

export function mediaSrc(ref: MediaRef): string {
  switch (ref.source) {
    case "asset":
      return `/media/assets/${ref.assetId}`;
    case "builtin":
      return `/media/builtin/${encodeURIComponent(ref.builtinId)}`;
    case "url":
      return ref.url;
  }
}

export function normaliseBackground(raw: unknown): Background {
  if (!raw || typeof raw !== "object") return { ...defaultBackground };
  const r = raw as Partial<Background>;
  const wallpaper = normaliseWallpaper(r.wallpaper);
  const library = Array.isArray(r.library)
    ? r.library.filter(isMediaRef).slice(0, maxLibraryEntries)
    : [];
  const photoMotion: PhotoMotion = {
    style:
      r.photoMotion?.style && motionStyles.includes(r.photoMotion.style)
        ? r.photoMotion.style
        : "none",
    intensity:
      typeof r.photoMotion?.intensity === "number" &&
      Number.isInteger(r.photoMotion.intensity)
        ? Math.min(100, Math.max(0, r.photoMotion.intensity))
        : 40,
  };
  const themeOverlayOpacity =
    typeof r.themeOverlayOpacity === "number" &&
    Number.isInteger(r.themeOverlayOpacity)
      ? Math.min(80, Math.max(0, r.themeOverlayOpacity))
      : 25;
  const out: Background = {
    wallpaper,
    library,
    photoMotion,
    themeOverlayOpacity,
  };
  if (r.effect && typeof r.effect === "object" && effectIds.includes(r.effect.id as EffectId)) {
    out.effect = {
      id: r.effect.id as EffectId,
      params:
        r.effect.params && typeof r.effect.params === "object"
          ? { ...r.effect.params }
          : {},
    };
  }
  if (
    r.tint &&
    typeof r.tint.colour === "string" &&
    /^#[a-fA-F0-9]{6}$/.test(r.tint.colour) &&
    typeof r.tint.opacity === "number" &&
    Number.isInteger(r.tint.opacity) &&
    r.tint.opacity >= 0 &&
    r.tint.opacity <= 80
  ) {
    out.tint = { colour: r.tint.colour.toLowerCase(), opacity: r.tint.opacity };
  }
  return out;
}

function normaliseWallpaper(raw: unknown): Wallpaper {
  if (!raw || typeof raw !== "object") return { kind: "none" };
  const w = raw as Wallpaper;
  switch (w.kind) {
    case "solid":
      return {
        kind: "solid",
        colour:
          typeof (w as { colour?: string }).colour === "string" &&
          /^#[a-fA-F0-9]{6}$/.test((w as { colour: string }).colour)
            ? (w as { colour: string }).colour.toLowerCase()
            : "#a2cbbb",
      };
    case "gradient": {
      const preset = (w as { preset?: string }).preset;
      if (preset && preset in gradients)
        return { kind: "gradient", preset: preset as keyof typeof gradients };
      return { kind: "gradient", preset: "dusk" };
    }
    case "image": {
      const media = (w as { media?: MediaRef }).media;
      if (!isMediaRef(media)) return { kind: "none" };
      const position = (w as { position?: string }).position;
      return {
        kind: "image",
        media,
        position:
          position === "top" || position === "bottom" || position === "center"
            ? position
            : "center",
      };
    }
    case "video": {
      const media = (w as { media?: MediaRef }).media;
      if (!isMediaRef(media) || media.source === "url") return { kind: "none" };
      const position = (w as { position?: string }).position;
      const playback = (w as { playback?: string }).playback;
      return {
        kind: "video",
        media,
        position:
          position === "top" || position === "bottom" || position === "center"
            ? position
            : "center",
        playback: playback === "static" ? "static" : "loop",
      };
    }
    default:
      return { kind: "none" };
  }
}

export function isMediaRef(v: unknown): v is MediaRef {
  if (!v || typeof v !== "object") return false;
  const r = v as MediaRef;
  if (r.source === "asset")
    return typeof r.assetId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(r.assetId);
  if (r.source === "builtin")
    return (
      typeof r.builtinId === "string" &&
      r.builtinId.includes("@v") &&
      r.builtinId.length <= 128 &&
      !r.builtinId.includes("..")
    );
  if (r.source === "url") return remoteImageURL(r.url);
  return false;
}

export function remoteImageURL(s: unknown): s is string {
  if (typeof s !== "string" || !s || s.length > 2048) return false;
  try {
    const u = new URL(s);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

/** Header/logo paths: empty, remote URL, or same-origin media asset path. */
export function logoReference(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!s) return true;
  if (s.startsWith("/media/assets/") || s.startsWith("/media/staging/")) {
    const id = s.split("/").pop() ?? "";
    return /^[A-Za-z0-9_-]{1,128}$/.test(id);
  }
  return remoteImageURL(s);
}

export function themeOverlayPaint(
  theme: "dark" | "light",
  opacity: number,
  paletteBackground?: string,
): string {
  const a = Math.min(80, Math.max(0, opacity)) / 100;
  if (a <= 0) return "transparent";
  if (theme === "light") return `rgba(255,255,255,${a})`;
  const hex =
    typeof paletteBackground === "string" &&
    /^#[a-fA-F0-9]{6}$/.test(paletteBackground)
      ? paletteBackground
      : palettes.dark.background;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export function creativeTintPaint(tint: CreativeTint): string {
  const [r, g, b] = [1, 3, 5].map((i) =>
    parseInt(tint.colour.slice(i, i + 2), 16),
  );
  return `rgba(${r},${g},${b},${tint.opacity / 100})`;
}

export function prependLibrary(library: MediaRef[], next: MediaRef): MediaRef[] {
  if (!isMediaRef(next)) return library;
  const rest = library.filter((v) => !mediaRefEqual(v, next));
  if (rest.length >= maxLibraryEntries && !library.some((v) => mediaRefEqual(v, next)))
    throw Error(`Media library is full (maximum ${maxLibraryEntries} items).`);
  return [next, ...rest].slice(0, maxLibraryEntries);
}

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) =>
  rgb(hex)
    .map((n) => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const within = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
function fields(value: unknown, allowed: string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    fail("appearance", "unknown_fields", "Unknown appearance fields.");
}
export function validateVisuals(a: AppearanceOptions) {
  if (a.background !== undefined) {
    a.background = normaliseBackground(a.background);
    fields(a.background, [
      "wallpaper",
      "library",
      "photoMotion",
      "effect",
      "tint",
      "themeOverlayOpacity",
    ]);
    const b = a.background;
    if (
      !within(b.themeOverlayOpacity, 0, 80) ||
      !motionStyles.includes(b.photoMotion.style) ||
      !within(b.photoMotion.intensity, 0, 100) ||
      !Array.isArray(b.library) ||
      b.library.length > maxLibraryEntries ||
      b.library.some((e) => !isMediaRef(e))
    )
      fail("appearance.background", "invalid_background", "Invalid background settings.");
    const w = b.wallpaper;
    if (
      (w.kind === "image" || w.kind === "video") &&
      w.media.source !== "builtin" &&
      !b.library.some((e) => mediaRefEqual(e, w.media))
    )
      fail("appearance.background.wallpaper", "wallpaper_not_in_library", "Active wallpaper must be present in the media library.");
    if (b.effect && !effectIds.includes(b.effect.id))
      fail("appearance.background.effect", "invalid_effect", "Invalid background effect.");
    if (
      b.tint &&
      (!/^#[a-fA-F0-9]{6}$/.test(b.tint.colour) ||
        !within(b.tint.opacity, 0, 80))
    )
      fail("appearance.background.tint", "invalid_tint", "Invalid creative tint.");
  }
  if (a.glass !== undefined) {
    a.glass = normaliseGlass(a.glass);
    fields(a.glass, [
      "mode",
      "opacity",
      "blur",
      "displacement",
      "aberration",
      "saturation",
    ]);
    if (
      !["solid", "glass"].includes(a.glass.mode) ||
      !within(a.glass.opacity, 0, 100) ||
      !within(a.glass.blur, 0, 24) ||
      !within(a.glass.displacement, 0, 100) ||
      !within(a.glass.aberration, 0, 100) ||
      !within(a.glass.saturation, 0, 100)
    )
      fail("appearance.glass", "invalid_glass", "Invalid global glass settings.");
  }
  if (a.palette !== undefined) {
    fields(a.palette, ["background", "surface", "text", "accent"]);
    const p = a.palette;
    if (
      ![p.background, p.surface, p.text, p.accent].every(
        (v) => typeof v === "string" && /^#[a-fA-F0-9]{6}$/.test(v),
      )
    )
      fail("appearance.palette", "invalid_hex", "Use six-digit hex colours.");
    const surfaceOk = contrast(p.text, p.surface) >= 4.5;
    const pageOk = contrast(p.text, p.background) >= 4.5;
    if (!surfaceOk && !pageOk)
      fail(
        "appearance.palette.text",
        "contrast",
        "Text needs at least 4.5:1 contrast against the page and pane colours.",
      );
    if (!surfaceOk)
      fail(
        "appearance.palette.text",
        "contrast_surface",
        "Text needs at least 4.5:1 contrast against the pane surface colour.",
      );
    if (!pageOk)
      fail(
        "appearance.palette.text",
        "contrast_page",
        "Text needs at least 4.5:1 contrast against the page colour.",
      );
  }
}
export function glassFill(theme: "dark" | "light", opacity: number) {
  const t = Math.min(1, Math.max(0, opacity / 100));
  return theme === "light"
    ? `rgba(255,255,255,${(t * 0.72).toFixed(3)})`
    : `rgba(255,255,255,${(t * 0.32).toFixed(3)})`;
}

export function appearanceStyle(a: AppearanceOptions): CSSProperties {
  const p = a.palette ?? palettes[a.theme],
    g = normaliseGlass(a.glass ?? defaultGlass);
  const clear = glassFill(a.theme, g.opacity);
  const mix = (pct: number) =>
    `color-mix(in srgb, ${p.surface} ${100 - pct}%, ${p.text})`;
  return {
    "--ui-font": uiFontFamily(a.fontFamily),
    "--bg": p.background,
    "--panel": p.surface,
    "--text": p.text,
    "--accent": p.accent,
    "--panel-high": mix(4.5),
    "--line": mix(20),
    "--muted": mix(72),
    "--accent-text":
      contrast(p.accent, "#000000") >= contrast(p.accent, "#ffffff")
        ? "#000000"
        : "#ffffff",
    "--glass-blur": `${g.blur}px`,
    "--surface-fill": g.mode === "glass" ? clear : p.surface,
    "--surface-filter":
      g.mode === "glass"
        ? `blur(${g.displacement > 0 ? Math.max(g.blur, 6) : g.blur}px) saturate(${glassSaturationCss(g.saturation)}%)`
        : "none",
    "--surface-depth":
      g.mode === "glass"
        ? a.theme === "light"
          ? "0 10px 36px rgb(0 0 0 / 0.12)"
          : "0 14px 44px rgb(0 0 0 / 0.28)"
        : "0 0 0 transparent",
    "--surface-highlight":
      g.mode === "glass" ? "var(--surface-depth)" : "0 0 0 transparent",
    "--surface-shine":
      g.mode === "glass"
        ? a.theme === "light"
          ? "linear-gradient(155deg, rgb(255 255 255 / 0.34) 0%, rgb(255 255 255 / 0.08) 32%, transparent 58%)"
          : "linear-gradient(155deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.04) 32%, transparent 58%)"
        : "none",
    "--surface-rim":
      g.mode === "glass"
        ? "linear-gradient(135deg, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / 0.28) 34%, rgb(255 255 255 / 0.5) 62%, rgb(255 255 255 / 0) 100%)"
        : "none",
    color: p.text,
    colorScheme: a.theme,
  } as CSSProperties;
}

/** Strip a media filename extension for compact UI labels. */
export function mediaDisplayName(name: string, fallback: string): string {
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  const base = trimmed.replace(/\.[A-Za-z0-9]{1,8}$/, "");
  return base || trimmed || fallback;
}

export function wallpaperLabel(b: Background, mediaName?: string): string {
  switch (b.wallpaper.kind) {
    case "none":
      return "None";
    case "solid":
      return "Colour";
    case "gradient":
      return b.wallpaper.preset[0].toUpperCase() + b.wallpaper.preset.slice(1);
    case "image":
      return mediaName ? mediaDisplayName(mediaName, "Photo") : "Photo";
    case "video":
      return mediaName ? mediaDisplayName(mediaName, "Video") : "Video";
  }
}
