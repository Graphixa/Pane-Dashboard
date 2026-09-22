import {
  type Background,
  type Glass,
  type Palette,
  imageReference,
  validateVisuals,
} from "./appearance";
export type Geometry = { x: number; y: number; w: number; h: number };
export type App = {
  id: string;
  name: string;
  url: string;
  icon: string;
  col: number;
  row: number;
  openInNewTab: boolean;
  source?: { provider: "docker"; id: string };
};
export type Pane = {
  id: string;
  type: "pane";
  title: string;
  layout: Geometry;
  apps: App[];
};
export type Config = {
  version: 2;
  dashboard: {
    title: string;
    logo?: string;
    branding?: "icon" | "logo";
    builtinIcon?: "grid" | "server" | "panels";
    widthMode: "fixed" | "full";
    width: number;
  };
  appearance: {
    showAppLabels: boolean;
    showButtonLabels: boolean;
    theme: "dark" | "light";
    paneTitleSize?: number;
    background?: Background;
    glass?: Glass;
    palette?: Palette;
  };
  items: Pane[];
};
export const tileSize = { icon: 80, w: 104, h: 120 };
// An 8px placement grid is a library adapter, not stored pane capacity.
// Frames include 8px on every edge, 32px for the external title, and 12px panel padding.
export const GRID = 8;
export const SNAP = 2; // 16px movement; retain schema-2 coordinates for existing layouts.
export const MAX_ROWS = 4096;
export const frame = (g: Geometry): Geometry => ({
  ...g,
  w: 4 + 14 * g.w,
  h: 8 + 16 * g.h,
});
export const slotsFromFrame = (g: Geometry): Geometry => ({
  ...g,
  w: Math.round((g.w - 4) / 14),
  h: Math.round((g.h - 8) / 16),
});
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export function capacity(g: Geometry) {
  return { cols: g.w, rows: g.h };
}
export function minimum(p: Pane) {
  const cols = Math.max(1, ...p.apps.map((a) => a.col + 1)),
    rows = Math.max(1, ...p.apps.map((a) => a.row + 1));
  return { w: cols, h: rows };
}
export function overlaps(a: Geometry, b: Geometry) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function freePosition(
  items: Pane[],
  w: number,
  h: number,
  width = 960,
): Geometry {
  const footprint = frame({ x: 0, y: 0, w, h });
  for (let y = 0; y <= MAX_ROWS - footprint.h; y += SNAP)
    for (let x = 0; x <= Math.floor(width / GRID) - footprint.w; x += SNAP) {
      const g = { x, y, w, h };
      if (!items.some((p) => overlaps(frame(p.layout), frame(g)))) return g;
    }
  throw Error("No free space remains. Move or resize a pane first.");
}
export function validURL(s: string, empty = true) {
  if (!s) return empty;
  try {
    const u = new URL(s);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !!u.hostname &&
      !u.username &&
      !u.password &&
      s.length <= 2048
    );
  } catch {
    return false;
  }
}
const id = /^[A-Za-z0-9_-]{1,100}$/;
const keys = (v: unknown, allowed: string[]) => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !allowed.includes(k))
  )
    throw Error("Unknown or malformed configuration fields.");
};
const integer = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
export function validate(value: unknown): asserts value is Config {
  keys(value, ["version", "dashboard", "appearance", "items"]);
  const c = value as Config;
  keys(c.dashboard, [
    "title",
    "logo",
    "branding",
    "builtinIcon",
    "widthMode",
    "width",
  ]);
  keys(c.appearance, [
    "showAppLabels",
    "showButtonLabels",
    "theme",
    "paneTitleSize",
    "background",
    "glass",
    "palette",
  ]);
  if (
    c.version !== 2 ||
    !text(c.dashboard.title, 100) ||
    (c.dashboard.logo !== undefined && !imageReference(c.dashboard.logo)) ||
    (c.dashboard.branding !== undefined &&
      !["icon", "logo"].includes(c.dashboard.branding)) ||
    (c.dashboard.builtinIcon !== undefined &&
      !["grid", "server", "panels"].includes(c.dashboard.builtinIcon)) ||
    !["fixed", "full"].includes(c.dashboard.widthMode) ||
    !integer(c.dashboard.width, 768, 3840)
  )
    throw Error("Unsupported version or dashboard settings.");
  if (
    !["dark", "light"].includes(c.appearance.theme) ||
    (c.appearance.paneTitleSize !== undefined &&
      !integer(c.appearance.paneTitleSize, 14, 22)) ||
    typeof c.appearance.showAppLabels !== "boolean" ||
    typeof c.appearance.showButtonLabels !== "boolean"
  )
    throw Error("Invalid appearance settings.");
  validateVisuals(c.appearance);
  if (!Array.isArray(c.items) || c.items.length > 100)
    throw Error("At most 100 panes are supported.");
  const ids = new Set<string>();
  let total = 0;
  for (const [i, p] of c.items.entries()) {
    keys(p, ["id", "type", "title", "layout", "apps"]);
    keys(p.layout, ["x", "y", "w", "h"]);
    if (
      typeof p.id !== "string" ||
      !id.test(p.id) ||
      ids.has(p.id) ||
      p.type !== "pane" ||
      !text(p.title, 100)
    )
      throw Error("Invalid pane identity or title.");
    ids.add(p.id);
    const g = p.layout;
    if (
      !integer(g.x, 0, 479) ||
      !integer(g.y, 0, MAX_ROWS - 1) ||
      !integer(g.w, 1, 32) ||
      !integer(g.h, 1, 32) ||
      (g.x + frame(g).w) * GRID > c.dashboard.width ||
      g.y + frame(g).h > MAX_ROWS ||
      c.items.slice(0, i).some((p) => overlaps(frame(p.layout), frame(g)))
    )
      throw Error("Panes must stay within the grid and cannot overlap.");
    if (
      !Array.isArray(p.apps) ||
      p.apps.length > 500 ||
      (total += p.apps.length) > 2000
    )
      throw Error("Too many apps.");
    const cap = capacity(g);
    if (cap.cols < 1 || cap.rows < 1)
      throw Error("Pane is too small for an app cell.");
    const slots = new Set<string>();
    for (const a of p.apps) {
      keys(a, [
        "id",
        "name",
        "url",
        "icon",
        "col",
        "row",
        "openInNewTab",
        "source",
      ]);
      if (
        typeof a.id !== "string" ||
        !id.test(a.id) ||
        ids.has(a.id) ||
        !text(a.name, 100) ||
        !a.name ||
        typeof a.openInNewTab !== "boolean"
      )
        throw Error("Invalid app identity or name.");
      ids.add(a.id);
      if (
        !text(a.url, 2048) ||
        !validURL(a.url) ||
        !text(a.icon, 2048) ||
        (a.icon &&
          !/^dashboard-icons:[a-z0-9][a-z0-9-]{0,100}$/.test(a.icon) &&
          !validURL(a.icon, false))
      )
        throw Error("Use HTTP(S) addresses without credentials.");
      const slot = `${a.col}:${a.row}`;
      if (
        !integer(a.col, 0, cap.cols - 1) ||
        !integer(a.row, 0, cap.rows - 1) ||
        slots.has(slot)
      )
        throw Error(
          "A pane would clip an app or has an occupied slot. Move apps or enlarge the pane first.",
        );
      slots.add(slot);
      if (a.source) {
        keys(a.source, ["provider", "id"]);
        if (
          a.source.provider !== "docker" ||
          !text(a.source.id, 500) ||
          !a.source.id
        )
          throw Error("Invalid source identity.");
      }
    }
  }
}
export function canPresent(c: Config, width: number) {
  return c.items.every((p) => (p.layout.x + frame(p.layout).w) * GRID <= width);
}
export function newPane(c: Config, title = "", apps: App[] = []): Pane {
  const p: Pane = {
    id: uid(),
    type: "pane",
    title,
    apps: [],
    layout: { x: 0, y: 0, w: 1, h: 1 },
  };
  const cols = 4;
  p.apps = apps.map((a, i) => ({
    ...a,
    id: uid(),
    col: i % cols,
    row: Math.floor(i / cols),
  }));
  const m = minimum(p);
  p.layout = freePosition(c.items, 4, m.h, c.dashboard.width);
  return p;
}
export function moveApp(
  c: Config,
  appId: string,
  paneId: string,
  col: number,
  row: number,
) {
  const n = clone(c);
  let app: App | undefined;
  for (const p of n.items) {
    app ??= p.apps.find((a) => a.id === appId);
    p.apps = p.apps.filter((a) => a.id !== appId);
  }
  const target = n.items.find((p) => p.id === paneId);
  if (!app || !target) throw Error("App or pane no longer exists.");
  target.apps.push({ ...app, col, row });
  validate(n);
  return n;
}
export function importApps(
  c: Config,
  apps: App[],
  destination: string,
  title: string,
) {
  const n = clone(c);
  let p: Pane;
  if (destination === "new") {
    p = newPane(n, title, apps);
    n.items.push(p);
  } else {
    p = n.items.find((p) => p.id === destination)!;
    if (!p) throw Error("Choose a destination pane.");
    const cap = capacity(p.layout);
    const slots: { col: number; row: number }[] = [];
    for (let row = 0; row < cap.rows; row++)
      for (let col = 0; col < cap.cols; col++)
        if (!p.apps.some((a) => a.col === col && a.row === row))
          slots.push({ col, row });
    if (slots.length < apps.length)
      throw Error(
        "Not enough empty slots. Enlarge the pane or create a new one.",
      );
    p.apps.push(...apps.map((a, i) => ({ ...a, id: uid(), ...slots[i] })));
  }
  validate(n);
  return { config: n, paneId: p.id };
}
export function sanitiseExport(c: Config) {
  const n = clone(c);
  for (const p of n.items)
    for (const a of p.apps) {
      a.url = "";
      delete a.source;
    }
  return n;
}
