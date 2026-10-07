import type { CSSProperties } from "react";
export type OverlayMode =
  | "dark-solid"
  | "dark-gradient"
  | "light-solid"
  | "light-gradient"
  | "custom";
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
export type Background = {
  kind: "none" | "solid" | "gradient" | "image" | "waves" | "aurora";
  preset: "dusk" | "ocean" | "forest" | "mist";
  colour: string;
  /** Active wallpaper image (data URI or HTTP(S) URL). */
  image: string;
  /** My images library, newest first. Active `image` is kept in sync when kind is image. */
  images: string[];
  overlay: OverlayMode;
  overlayOpacity: number;
  overlayColour: string;
  position: "center" | "top" | "bottom";
  motion: boolean;
  motionStyle: MotionStyle;
  intensity: number;
};
/** Cap keeps embedded backups within the 8 MiB configuration bound. */
export const maxBackgroundImages = 4;
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
/** Bundled font id for display and controls; invalid or empty values fall back to Geist. */
export function resolveUiFont(value: unknown): UiFont {
  if (
    typeof value === "string" &&
    value !== "" &&
    uiFonts.some((f) => f.id === value)
  )
    return value as UiFont;
  return defaultUiFont;
}
/** Drop empty or unknown fontFamily so optional appearance stays valid. */
export function normaliseAppearanceFont<T extends { fontFamily?: UiFont }>(
  appearance: T,
): T {
  const { fontFamily, ...rest } = appearance;
  if (fontFamily === undefined) return appearance;
  // Runtime configs may carry "" or other strings; strip anything not in uiFonts.
  if (uiFonts.some((f) => f.id === (fontFamily as string))) return appearance;
  return rest as T;
}
export const overlayModes: OverlayMode[] = [
  "dark-solid",
  "dark-gradient",
  "light-solid",
  "light-gradient",
  "custom",
];
export const defaultBackground: Background = {
  kind: "none",
  preset: "dusk",
  colour: "#a2cbbb",
  image: "",
  images: [],
  overlay: "dark-solid",
  overlayOpacity: 25,
  overlayColour: "#111720",
  position: "center",
  motion: false,
  motionStyle: "none",
  intensity: 40,
};
export function resolveMotionStyle(
  raw: Partial<Background>,
  kind: Background["kind"],
  motion: boolean,
): MotionStyle {
  if (raw.motionStyle && motionStyles.includes(raw.motionStyle))
    return raw.motionStyle;
  if (!motion) return "none";
  return kind === "image" ? "ken-burns" : "drift";
}
/** Map speed (0–100) to CSS animation duration without rewriting it on every tick. */
export function motionDurationSeconds(intensity: number) {
  const n = Number.isFinite(intensity) ? Math.min(100, Math.max(0, intensity)) : 40;
  return Math.round((80 - n * 0.74) * 10) / 10;
}
/** Parse a typed integer for settings fields; empty or out-of-range returns undefined. */
export function parseIntegerInput(raw: string, min: number, max: number) {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}
export function withMotionStyle(style: MotionStyle): Pick<
  Background,
  "motionStyle" | "motion"
> {
  return { motionStyle: style, motion: style !== "none" };
}
// Defaults favour a clear wash with full edge bend and moderate chroma.
export const defaultGlass: Glass = {
  mode: "solid",
  opacity: 15,
  blur: 2,
  displacement: 100,
  aberration: 60,
  saturation: 75,
};
/** CSS saturate() percent for a stored 0–100 saturation control (75 → 150%). */
export function glassSaturationCss(saturation: number) {
  return Math.round(Math.min(100, Math.max(0, saturation)) * 2);
}
/** SVG displacement scale for a stored 0–100 control (100 → former max of 150). */
export function glassDisplacementScale(displacement: number) {
  return Math.round(Math.min(100, Math.max(0, displacement)) * 1.5);
}
/** Map 0–100 aberration into the filter’s former 0–5 units. */
export function glassAberrationUnits(aberration: number) {
  return Math.min(100, Math.max(0, aberration)) / 20;
}
export function normaliseGlass(
  g: Partial<Glass> & Pick<Glass, "mode" | "opacity" | "blur">,
): Glass {
  return {
    mode: g.mode,
    opacity: g.opacity,
    blur: g.blur,
    displacement: g.displacement ?? defaultGlass.displacement,
    aberration: g.aberration ?? defaultGlass.aberration,
    saturation: g.saturation ?? defaultGlass.saturation,
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
/** Named accent chips: lighter on Midnight, darker on Daylight (Mint pair is the theme default). */
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
/** Keep a named accent across theme changes; drop fully custom palettes. */
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
export function defaultOverlayColour(theme: "dark" | "light") {
  return theme === "light" ? "#f5f6f2" : "#111720";
}

export function overlayForTheme(
  theme: "dark" | "light",
  current: OverlayMode,
): OverlayMode {
  if (current === "custom") return current;
  const gradient = current.includes("gradient");
  return theme === "dark"
    ? gradient
      ? "dark-gradient"
      : "dark-solid"
    : gradient
      ? "light-gradient"
      : "light-solid";
}
/** Fixed wash of Colours hex over theme `--bg` (not a full-bleed solid fill). */
export const SOLID_TINT_PERCENT = 28;

/** Paint for wallpaper kind solid: tint theme page background with the chip colour. */
export function solidBackgroundPaint(colour: string): string {
  const hex =
    typeof colour === "string" && /^#[a-fA-F0-9]{6}$/.test(colour)
      ? colour.toLowerCase()
      : defaultBackground.colour;
  return `color-mix(in srgb, ${hex} ${SOLID_TINT_PERCENT}%, var(--bg))`;
}

/**
 * Deduplicate My images preserving date-added order (newest first).
 * Only prepend active `image` when it is missing (legacy orphan); never reshuffle on select.
 */
export function normaliseBackgroundImages(
  image: string,
  images: unknown,
): string[] {
  const fromList = Array.isArray(images)
    ? images.filter((v): v is string => imageReference(v) && !!v)
    : [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const entry of fromList) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    unique.push(entry);
    if (unique.length >= maxBackgroundImages) break;
  }
  const active = imageReference(image) && image ? image : "";
  if (active && !seen.has(active)) {
    unique.unshift(active);
    if (unique.length > maxBackgroundImages) unique.length = maxBackgroundImages;
  }
  return unique;
}

/** Prepend a new upload; drop the oldest when the library is full. */
export function prependBackgroundImage(
  library: string[],
  next: string,
): string[] {
  if (!imageReference(next) || !next) return library;
  return [next, ...library.filter((v) => v !== next)].slice(
    0,
    maxBackgroundImages,
  );
}

export function migrateBackground(
  raw: Partial<Background> & { dimming?: number },
  theme: "dark" | "light",
): Background {
  const base = { ...defaultBackground, ...raw };
  const motionStyle = resolveMotionStyle(raw, base.kind, !!base.motion);
  const motion = motionStyle !== "none";
  const image = typeof base.image === "string" ? base.image : "";
  const images = normaliseBackgroundImages(image, raw.images ?? base.images);
  const colour =
    typeof raw.colour === "string" && /^#[a-fA-F0-9]{6}$/.test(raw.colour)
      ? raw.colour.toLowerCase()
      : defaultBackground.colour;
  if (
    raw.overlay &&
    overlayModes.includes(raw.overlay) &&
    typeof raw.overlayOpacity === "number" &&
    typeof raw.overlayColour === "string"
  ) {
    return {
      kind: base.kind,
      preset: base.preset,
      colour,
      image,
      images,
      overlay: raw.overlay,
      overlayOpacity: raw.overlayOpacity,
      overlayColour: raw.overlayColour,
      position: base.position,
      motion,
      motionStyle,
      intensity: base.intensity,
    };
  }
  const dimming =
    typeof raw.dimming === "number" && Number.isInteger(raw.dimming)
      ? raw.dimming
      : defaultBackground.overlayOpacity;
  return {
    kind: base.kind,
    preset: base.preset,
    colour,
    image,
    images,
    overlay: theme === "light" ? "light-solid" : "dark-solid",
    overlayOpacity: dimming,
    overlayColour: defaultOverlayColour(theme),
    position: base.position,
    motion,
    motionStyle,
    intensity: base.intensity,
  };
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function overlayBackground(b: Background): string {
  const a = b.overlayOpacity / 100;
  let paint = `rgba(0,0,0,${a})`;
  if (b.overlay === "custom") {
    const [r, g, bl] = rgb(b.overlayColour);
    paint = `rgba(${r},${g},${bl},${a})`;
  } else if (b.overlay.startsWith("light")) {
    paint = `rgba(255,255,255,${a})`;
  }
  return b.overlay.includes("gradient")
    ? `linear-gradient(to bottom, ${paint}, transparent)`
    : paint;
}
export function imageReference(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!s) return true;
  if (s.startsWith("data:")) {
    const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
    if (
      !m ||
      m[2].length > Math.ceil((2 * 1024 * 1024) / 3) * 4 ||
      m[2].length % 4 !== 0
    )
      return false;
    try {
      const b = atob(m[2]);
      return (
        b.length <= 2 * 1024 * 1024 &&
        (m[1] === "png"
          ? b.startsWith("\x89PNG\r\n\x1a\n")
          : b.startsWith("\xff\xd8\xff"))
      );
    } catch {
      return false;
    }
  }
  try {
    const u = new URL(s);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !u.username &&
      !u.password &&
      s.length <= 2048
    );
  } catch {
    return false;
  }
}
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
    throw Error("Unknown appearance fields.");
}
export function validateVisuals(a: AppearanceOptions) {
  if (a.background !== undefined) {
    a.background = migrateBackground(
      a.background as Background & { dimming?: number },
      a.theme,
    );
    fields(a.background, [
      "kind",
      "preset",
      "colour",
      "image",
      "images",
      "overlay",
      "overlayOpacity",
      "overlayColour",
      "position",
      "motion",
      "motionStyle",
      "intensity",
    ]);
    const b = a.background;
    if (
      !["none", "solid", "gradient", "image", "waves", "aurora"].includes(b.kind) ||
      !Object.hasOwn(gradients, b.preset) ||
      !imageReference(b.image) ||
      !Array.isArray(b.images) ||
      b.images.length > maxBackgroundImages ||
      b.images.some((entry) => !imageReference(entry) || !entry) ||
      (b.kind === "image" && !b.image) ||
      (b.kind === "image" && b.image && !b.images.includes(b.image)) ||
      !/^#[a-fA-F0-9]{6}$/.test(b.colour) ||
      !overlayModes.includes(b.overlay) ||
      !within(b.overlayOpacity, 0, 80) ||
      !/^#[a-fA-F0-9]{6}$/.test(b.overlayColour) ||
      !within(b.intensity, 0, 100) ||
      !["center", "top", "bottom"].includes(b.position) ||
      !motionStyles.includes(b.motionStyle) ||
      typeof b.motion !== "boolean" ||
      b.motion !== (b.motionStyle !== "none")
    )
      throw Error("Invalid background settings or image.");
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
      throw Error("Invalid global glass settings.");
  }
  if (a.palette !== undefined) {
    fields(a.palette, ["background", "surface", "text", "accent"]);
    const p = a.palette;
    if (
      ![p.background, p.surface, p.text, p.accent].every(
        (v) => typeof v === "string" && /^#[a-fA-F0-9]{6}$/.test(v),
      )
    )
      throw Error("Use six-digit hex colours.");
    if (
      contrast(p.text, p.surface) < 4.5 ||
      contrast(p.text, p.background) < 4.5
    )
      throw Error(
        "Text needs at least 4.5:1 contrast against the page and pane colours.",
      );
  }
}
/** Clear glass wash: theme tone only, never the solid surface paint. */
export function glassFill(theme: "dark" | "light", opacity: number) {
  const t = Math.min(1, Math.max(0, opacity / 100));
  // 0% = clear wash (testing); higher values add theme-toned frost.
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
    // Base frost when displacing so the filter warps backdrop, not the AA edge.
    "--surface-filter":
      g.mode === "glass"
        ? `blur(${g.displacement > 0 ? Math.max(g.blur, 6) : g.blur}px) saturate(${glassSaturationCss(g.saturation)}%)`
        : "none",
    // Outer depth only — inset bevels read as embossed metal, not liquid glass.
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
