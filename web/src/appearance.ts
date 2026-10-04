import type { CSSProperties } from "react";
export type OverlayMode =
  | "dark-solid"
  | "dark-gradient"
  | "light-solid"
  | "light-gradient"
  | "custom";
export type Background = {
  kind: "none" | "gradient" | "image" | "waves" | "aurora";
  preset: "dusk" | "ocean" | "forest" | "mist";
  image: string;
  overlay: OverlayMode;
  overlayOpacity: number;
  overlayColour: string;
  position: "center" | "top" | "bottom";
  motion: boolean;
  intensity: number;
};
export type Glass = { mode: "solid" | "glass"; opacity: number; blur: number };
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
  glass?: Glass;
  palette?: Palette;
};
export const uiFonts: { id: UiFont; label: string; family: string }[] = [
  { id: "geist", label: "Geist", family: "Geist" },
  { id: "rubik", label: "Rubik", family: "Rubik" },
  { id: "oxanium", label: "Oxanium", family: "Oxanium" },
];
export const defaultUiFont: UiFont = "geist";
export function uiFontFamily(id?: UiFont) {
  return uiFonts.find((f) => f.id === (id ?? defaultUiFont))?.family ?? "Geist";
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
  image: "",
  overlay: "dark-solid",
  overlayOpacity: 25,
  overlayColour: "#111720",
  position: "center",
  motion: true,
  intensity: 40,
};
export const defaultGlass: Glass = { mode: "solid", opacity: 70, blur: 14 };
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
export function migrateBackground(
  raw: Partial<Background> & { dimming?: number },
  theme: "dark" | "light",
): Background {
  const base = { ...defaultBackground, ...raw };
  if (
    raw.overlay &&
    overlayModes.includes(raw.overlay) &&
    typeof raw.overlayOpacity === "number" &&
    typeof raw.overlayColour === "string"
  ) {
    return {
      kind: base.kind,
      preset: base.preset,
      image: base.image ?? "",
      overlay: raw.overlay,
      overlayOpacity: raw.overlayOpacity,
      overlayColour: raw.overlayColour,
      position: base.position,
      motion: base.motion,
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
    image: base.image ?? "",
    overlay: theme === "light" ? "light-solid" : "dark-solid",
    overlayOpacity: dimming,
    overlayColour: defaultOverlayColour(theme),
    position: base.position,
    motion: base.motion,
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
      "image",
      "overlay",
      "overlayOpacity",
      "overlayColour",
      "position",
      "motion",
      "intensity",
    ]);
    const b = a.background;
    if (
      !["none", "gradient", "image", "waves", "aurora"].includes(b.kind) ||
      !Object.hasOwn(gradients, b.preset) ||
      !imageReference(b.image) ||
      (b.kind === "image" && !b.image) ||
      !overlayModes.includes(b.overlay) ||
      !within(b.overlayOpacity, 0, 80) ||
      !/^#[a-fA-F0-9]{6}$/.test(b.overlayColour) ||
      !within(b.intensity, 0, 100) ||
      !["center", "top", "bottom"].includes(b.position) ||
      typeof b.motion !== "boolean"
    )
      throw Error("Invalid background settings or image.");
  }
  if (a.glass !== undefined) {
    fields(a.glass, ["mode", "opacity", "blur"]);
    if (
      !["solid", "glass"].includes(a.glass.mode) ||
      !within(a.glass.opacity, 0, 100) ||
      !within(a.glass.blur, 0, 24)
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
    g = a.glass ?? defaultGlass;
  const mix = (x: string, y: string, ratio: number) => {
    const b = rgb(y);
    return `rgb(${rgb(x)
      .map((v, i) => Math.round(v * (1 - ratio) + b[i] * ratio))
      .join(",")})`;
  };
  const clear = glassFill(a.theme, g.opacity);
  return {
    "--ui-font": uiFontFamily(a.fontFamily),
    "--bg": p.background,
    "--panel": p.surface,
    "--text": p.text,
    "--accent": p.accent,
    "--panel-high": mix(p.surface, p.text, 0.045),
    "--line": mix(p.surface, p.text, 0.2),
    "--muted": mix(p.surface, p.text, 0.72),
    "--accent-text":
      contrast(p.accent, "#000000") >= contrast(p.accent, "#ffffff")
        ? "#000000"
        : "#ffffff",
    "--glass-fill": clear,
    "--glass-blur": `${g.blur}px`,
    "--surface-fill": g.mode === "glass" ? clear : p.surface,
    "--surface-filter":
      g.mode === "glass"
        ? `blur(${g.blur}px) saturate(140%)`
        : "none",
    "--surface-edge":
      g.mode === "glass"
        ? a.theme === "light"
          ? "rgb(255 255 255 / 0.42)"
          : "rgb(255 255 255 / 0.14)"
        : "transparent",
    "--surface-depth":
      g.mode === "glass"
        ? a.theme === "light"
          ? "0 12px 32px rgb(0 0 0 / 0.12)"
          : "0 14px 40px rgb(0 0 0 / 0.3)"
        : "0 0 0 transparent",
    "--surface-highlight":
      g.mode === "glass"
        ? [
            "inset 0 1px 0 rgb(255 255 255 / 0.34)",
            "inset 0 -1px 0 rgb(255 255 255 / 0.06)",
            "inset 1px 0 0 rgb(255 255 255 / 0.14)",
            "inset -1px 0 0 rgb(255 255 255 / 0.08)",
            "var(--surface-depth)",
          ].join(", ")
        : "0 0 0 transparent",
    "--surface-shine":
      g.mode === "glass"
        ? a.theme === "light"
          ? "linear-gradient(150deg, rgb(255 255 255 / 0.5) 0%, rgb(255 255 255 / 0.12) 30%, transparent 55%, rgb(255 255 255 / 0.08) 100%)"
          : "linear-gradient(150deg, rgb(255 255 255 / 0.26) 0%, rgb(255 255 255 / 0.06) 28%, transparent 52%, rgb(255 230 200 / 0.07) 100%)"
        : "none",
    "--surface-rim":
      g.mode === "glass"
        ? a.theme === "light"
          ? "linear-gradient(135deg, rgb(255 255 255 / 0.7) 0%, rgb(255 255 255 / 0.18) 40%, rgb(255 255 255 / 0.35) 100%)"
          : "linear-gradient(135deg, rgb(255 255 255 / 0.42) 0%, rgb(255 255 255 / 0.08) 38%, rgb(255 220 180 / 0.2) 100%)"
        : "none",
    color: p.text,
    colorScheme: a.theme,
  } as CSSProperties;
}
