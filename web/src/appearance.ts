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
export type AppearanceOptions = {
  theme: "dark" | "light";
  background?: Background;
  glass?: Glass;
  palette?: Palette;
};
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
export function overlayPaint(b: Background): string {
  const a = b.overlayOpacity / 100;
  if (b.overlay === "custom") {
    const [r, g, bl] = rgb(b.overlayColour);
    return `rgba(${r},${g},${bl},${a})`;
  }
  if (b.overlay.startsWith("light")) return `rgba(255,255,255,${a})`;
  return `rgba(0,0,0,${a})`;
}
export function overlayBackground(b: Background): string {
  const paint = overlayPaint(b);
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
function fields(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
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
      !within(a.glass.opacity, 30, 100) ||
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
export function appearanceStyle(a: AppearanceOptions): CSSProperties {
  const p = a.palette ?? palettes[a.theme],
    g = a.glass ?? defaultGlass;
  const mix = (x: string, y: string, ratio: number) => {
    const b = rgb(y);
    return `rgb(${rgb(x)
      .map((v, i) => Math.round(v * (1 - ratio) + b[i] * ratio))
      .join(",")})`;
  };
  return {
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
    "--glass-fill": `rgba(${rgb(p.surface).join(",")},${g.opacity / 100})`,
    "--glass-blur": `${g.blur}px`,
    "--surface-fill":
      g.mode === "glass"
        ? `rgba(${rgb(p.surface).join(",")},${g.opacity / 100})`
        : p.surface,
    "--surface-filter":
      g.mode === "glass" ? `blur(${g.blur}px) saturate(1.2)` : "none",
    "--surface-highlight":
      g.mode === "glass"
        ? "inset 0 1px 0 #ffffff45, 0 12px 32px #0002"
        : "0 0 0 transparent",
    color: p.text,
    colorScheme: a.theme,
  } as CSSProperties;
}
