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

const cssModules = import.meta.glob<string>("./*.{css}", {
  eager: true,
  query: "?raw",
  import: "default",
});
const htmlModules = import.meta.glob<string>("./*.{html}", {
  eager: true,
  query: "?raw",
  import: "default",
});

function loadRaw(map: Record<string, string>, name: string): string {
  const hit = Object.entries(map).find(([p]) => p.endsWith(`/${name}`));
  return hit?.[1] ?? "";
}

function scopeCss(id: EffectId, css: string): string {
  let out = css.replace(
    /@keyframes\s+([a-zA-Z_][\w-]*)/g,
    (_m, name: string) => `@keyframes pane-fx-${id}-${name}`,
  );
  out = out.replace(
    /(animation(?:-name)?\s*:\s*)([^;}+]+)/g,
    (_m, prefix: string, value: string) => {
      const next = value.replace(
        /\b([a-zA-Z_][\w-]*)\b/g,
        (token) =>
          /^(linear|ease|ease-in|ease-out|ease-in-out|infinite|alternate|forwards|backwards|both|none|normal|reverse|paused|running|ms|s|\d)/.test(
            token,
          ) || token.includes("(")
            ? token
            : `pane-fx-${id}-${token}`,
      );
      return prefix + next;
    },
  );
  return `@scope (.scene-effect[data-effect-id="${id}"]) {\n${out}\n}`;
}

const snowCss = loadRaw(cssModules, "snow.css");
const firefliesCss = loadRaw(cssModules, "fireflies.css");
const shootingCss = loadRaw(cssModules, "shooting-stars.css");

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
