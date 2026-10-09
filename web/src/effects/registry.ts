import type { EffectId } from "../appearance";

export type EffectControl =
  | {
      key: string;
      label: string;
      type: "range";
      min: number;
      max: number;
      default: number;
      cssVar: string;
      map?: "duration";
    }
  | {
      key: string;
      label: string;
      type: "colour";
      default: string;
      cssVar: string;
    };

export type EffectPack = {
  id: EffectId;
  name: string;
  css: string;
  fragment: string;
  controls: EffectControl[];
};

// Use .pack.txt (not .css) so Vite/Vitest do not mock raw stylesheet imports to "".
const cssModules = import.meta.glob<string>("./*.pack.txt", {
  eager: true,
  query: "?raw",
  import: "default",
});
const htmlModules = import.meta.glob<string>("./*.html", {
  eager: true,
  query: "?raw",
  import: "default",
});

function loadRaw(map: Record<string, string>, name: string): string {
  const hit = Object.entries(map).find(([p]) => p.endsWith(`/${name}`));
  return hit?.[1] ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefix keyframe names only — never rewrite var()/calc() tokens in animation values. */
function scopeCss(id: EffectId, css: string): string {
  const names: string[] = [];
  let out = css.replace(
    /@keyframes\s+([a-zA-Z_][\w-]*)/g,
    (_m, name: string) => {
      names.push(name);
      return `@keyframes pane-fx-${id}-${name}`;
    },
  );
  for (const name of names) {
    const re = new RegExp(`(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`, "g");
    out = out.replace(re, `pane-fx-${id}-${name}`);
  }
  return `@scope (.scene-effect[data-effect-id="${id}"]) {\n${out}\n}`;
}

const snowCss = loadRaw(cssModules, "snow.pack.txt");
const firefliesCss = loadRaw(cssModules, "fireflies.pack.txt");
const shootingCss = loadRaw(cssModules, "shooting-stars.pack.txt");

export const effectPacks: Record<EffectId, EffectPack> = {
  snow: {
    id: "snow",
    name: "Snow",
    css: scopeCss("snow", snowCss),
    fragment: loadRaw(htmlModules, "snow.html"),
    controls: [
      {
        key: "seed",
        label: "Colour",
        type: "colour",
        default: "#ffffff",
        cssVar: "--pane-seed",
      },
      {
        key: "speed",
        label: "Speed",
        type: "range",
        min: 0,
        max: 100,
        default: 45,
        cssVar: "--pane-speed",
        map: "duration",
      },
      {
        key: "density",
        label: "Amount",
        type: "range",
        min: 0,
        max: 100,
        default: 55,
        cssVar: "--pane-density",
      },
    ],
  },
  fireflies: {
    id: "fireflies",
    name: "Fireflies",
    css: scopeCss("fireflies", firefliesCss),
    fragment: loadRaw(htmlModules, "fireflies.html"),
    controls: [
      {
        key: "seed",
        label: "Colour",
        type: "colour",
        default: "#d4e157",
        cssVar: "--pane-seed",
      },
      {
        key: "speed",
        label: "Speed",
        type: "range",
        min: 0,
        max: 100,
        default: 45,
        cssVar: "--pane-speed",
        map: "duration",
      },
      {
        key: "glow",
        label: "Glow",
        type: "range",
        min: 0,
        max: 30,
        default: 14,
        cssVar: "--pane-glow",
      },
      {
        key: "size",
        label: "Size",
        type: "range",
        min: 2,
        max: 10,
        default: 4,
        cssVar: "--pane-size",
      },
    ],
  },
  "shooting-stars": {
    id: "shooting-stars",
    name: "Shooting stars",
    css: scopeCss("shooting-stars", shootingCss),
    fragment: loadRaw(htmlModules, "shooting-stars.html"),
    controls: [
      {
        key: "seed",
        label: "Colour",
        type: "colour",
        default: "#ffffff",
        cssVar: "--pane-seed",
      },
      {
        key: "speed",
        label: "Speed",
        type: "range",
        min: 0,
        max: 100,
        default: 50,
        cssVar: "--pane-speed",
        map: "duration",
      },
    ],
  },
};

export function getEffectPack(id: string): EffectPack | undefined {
  return effectPacks[id as EffectId];
}

export function listEffectPacks(): EffectPack[] {
  return Object.values(effectPacks);
}

export function effectCssVars(
  pack: EffectPack,
  params: Record<string, string | number | boolean>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of pack.controls) {
    const raw = params[c.key] ?? c.default;
    if (c.type === "colour") {
      out[c.cssVar] = typeof raw === "string" ? raw : c.default;
      continue;
    }
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : c.default;
    const clamped = Math.min(
      c.max,
      Math.max(c.min, Number.isFinite(n) ? n : c.default),
    );
    if (c.map === "duration") {
      out[c.cssVar] = `${Math.round((80 - clamped * 0.74) * 10) / 10}s`;
    } else {
      out[c.cssVar] = String(clamped);
    }
  }
  return out;
}
