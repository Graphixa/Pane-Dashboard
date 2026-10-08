import type {
  DynamicControl,
  DynamicManifest,
  DynamicParams,
  DynamicParamValue,
} from "./types";
import { DYNAMIC_CSS_VAR_RE, DYNAMIC_KEY_RE } from "./types";

/** Pack speed 0–100 → ~20s–3s (snappier than image Ken Burns). */
function durationSeconds(intensity: number) {
  const n = Number.isFinite(intensity) ? Math.min(100, Math.max(0, intensity)) : 40;
  return Math.round((20 - n * 0.17) * 10) / 10;
}

export function defaultDynamicParams(manifest: DynamicManifest): DynamicParams {
  const out: DynamicParams = {};
  for (const c of manifest.controls) out[c.key] = c.default;
  return out;
}

export function cssValueForControl(
  control: DynamicControl,
  value: DynamicParamValue,
): string {
  if (control.type === "range") {
    const n = typeof value === "number" ? value : Number(value);
    const clamped = Math.min(control.max, Math.max(control.min, n));
    if (control.map === "duration") return `${durationSeconds(clamped)}s`;
    return String(clamped);
  }
  if (control.type === "toggle") return value ? "1" : "0";
  return String(value);
}

/** Build inline style properties for the dynamic scene host. */
export function dynamicCssVars(
  manifest: DynamicManifest,
  params: DynamicParams,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const control of manifest.controls) {
    if (!DYNAMIC_CSS_VAR_RE.test(control.cssVar)) continue;
    const raw = params[control.key] ?? control.default;
    vars[control.cssVar] = cssValueForControl(control, raw);
  }
  return vars;
}

export function validateDynamicParams(
  manifest: DynamicManifest,
  params: unknown,
): DynamicParams {
  const defaults = defaultDynamicParams(manifest);
  if (!params || typeof params !== "object" || Array.isArray(params))
    return defaults;
  const raw = params as Record<string, unknown>;
  const out: DynamicParams = { ...defaults };
  for (const control of manifest.controls) {
    if (!DYNAMIC_KEY_RE.test(control.key)) continue;
    if (!(control.key in raw)) continue;
    const value = raw[control.key];
    if (control.type === "range") {
      if (typeof value === "number" && Number.isFinite(value)) {
        const n = Math.round(value);
        if (n >= control.min && n <= control.max) out[control.key] = n;
      }
    } else if (control.type === "colour") {
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value))
        out[control.key] = value.toLowerCase();
    } else if (control.type === "toggle") {
      if (typeof value === "boolean") out[control.key] = value;
    } else if (control.type === "select") {
      if (
        typeof value === "string" &&
        control.options.some((o) => o.value === value)
      )
        out[control.key] = value;
    }
  }
  return out;
}

export function parseManifest(raw: unknown): DynamicManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== "string" || typeof m.name !== "string") return null;
  if (!Array.isArray(m.controls)) return null;
  const controls: DynamicControl[] = [];
  for (const item of m.controls) {
    if (!item || typeof item !== "object") return null;
    const c = item as Record<string, unknown>;
    if (
      typeof c.key !== "string" ||
      !DYNAMIC_KEY_RE.test(c.key) ||
      typeof c.label !== "string" ||
      typeof c.cssVar !== "string" ||
      !DYNAMIC_CSS_VAR_RE.test(c.cssVar) ||
      typeof c.type !== "string"
    )
      return null;
    if (c.type === "range") {
      if (
        typeof c.min !== "number" ||
        typeof c.max !== "number" ||
        typeof c.default !== "number"
      )
        return null;
      controls.push({
        key: c.key,
        label: c.label,
        type: "range",
        min: c.min,
        max: c.max,
        step: typeof c.step === "number" ? c.step : 1,
        default: c.default,
        cssVar: c.cssVar,
        map: c.map === "duration" ? "duration" : undefined,
      });
    } else if (c.type === "colour") {
      if (typeof c.default !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c.default))
        return null;
      controls.push({
        key: c.key,
        label: c.label,
        type: "colour",
        default: c.default.toLowerCase(),
        cssVar: c.cssVar,
      });
    } else if (c.type === "toggle") {
      if (typeof c.default !== "boolean") return null;
      controls.push({
        key: c.key,
        label: c.label,
        type: "toggle",
        default: c.default,
        cssVar: c.cssVar,
      });
    } else if (c.type === "select") {
      if (typeof c.default !== "string" || !Array.isArray(c.options)) return null;
      const options = c.options
        .filter(
          (o): o is { value: string; label: string } =>
            !!o &&
            typeof o === "object" &&
            typeof (o as { value?: unknown }).value === "string" &&
            typeof (o as { label?: unknown }).label === "string",
        )
        .map((o) => ({ value: o.value, label: o.label }));
      if (!options.some((o) => o.value === c.default)) return null;
      controls.push({
        key: c.key,
        label: c.label,
        type: "select",
        default: c.default,
        cssVar: c.cssVar,
        options,
      });
    } else return null;
  }
  return {
    id: m.id,
    name: m.name,
    description: typeof m.description === "string" ? m.description : undefined,
    controls,
  };
}
