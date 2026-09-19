export type Size = "small" | "medium" | "large";
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
  version: 1;
  dashboard: { title: string; widthMode: "fixed" | "full"; width: number };
  appearance: {
    appSize: Size;
    showAppLabels: boolean;
    showButtonLabels: boolean;
    theme: "dark" | "light";
  };
  items: Pane[];
};
export const sizes = {
  small: { icon: 48, w: 72, h: 88 },
  medium: { icon: 64, w: 88, h: 104 },
  large: { icon: 80, w: 104, h: 120 },
};
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export function capacity(g: Geometry, width: number, size: Size) {
  const cell = sizes[size];
  return {
    cols: Math.floor(((g.w * (width + 8)) / 24 - 8 - 24 + 8) / (cell.w + 8)),
    rows: Math.floor((g.h * 32 - 8 - 64 + 8) / (cell.h + 8)),
  };
}
export function minimum(p: Pane, width: number, size: Size) {
  const cols = Math.max(1, ...p.apps.map((a) => a.col + 1)),
    rows = Math.max(1, ...p.apps.map((a) => a.row + 1)),
    cell = sizes[size];
  return {
    w: Math.ceil(((24 + cols * (cell.w + 8)) * 24) / (width + 8)),
    h: Math.ceil((64 + rows * (cell.h + 8)) / 32),
  };
}
export function overlaps(a: Geometry, b: Geometry) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function freePosition(items: Pane[], w: number, h: number): Geometry {
  for (let y = 0; y <= 256 - h; y++)
    for (let x = 0; x <= 24 - w; x++) {
      const g = { x, y, w, h };
      if (!items.some((p) => overlaps(p.layout, g))) return g;
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
  keys(c.dashboard, ["title", "widthMode", "width"]);
  keys(c.appearance, ["appSize", "showAppLabels", "showButtonLabels", "theme"]);
  if (
    c.version !== 1 ||
    !text(c.dashboard.title, 100) ||
    !["fixed", "full"].includes(c.dashboard.widthMode) ||
    !integer(c.dashboard.width, 768, 3840)
  )
    throw Error("Unsupported version or dashboard settings.");
  if (
    !Object.hasOwn(sizes, c.appearance.appSize) ||
    !["dark", "light"].includes(c.appearance.theme) ||
    typeof c.appearance.showAppLabels !== "boolean" ||
    typeof c.appearance.showButtonLabels !== "boolean"
  )
    throw Error("Invalid appearance settings.");
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
      !integer(g.x, 0, 23) ||
      !integer(g.y, 0, 255) ||
      !integer(g.w, 1, 24) ||
      !integer(g.h, 1, 256) ||
      g.x + g.w > 24 ||
      g.y + g.h > 256 ||
      c.items.slice(0, i).some((p) => overlaps(p.layout, g))
    )
      throw Error("Panes must stay within the grid and cannot overlap.");
    if (
      !Array.isArray(p.apps) ||
      p.apps.length > 500 ||
      (total += p.apps.length) > 2000
    )
      throw Error("Too many apps.");
    const cap = capacity(g, c.dashboard.width, c.appearance.appSize);
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
  return c.items.every((p) => {
    const m = minimum(p, width, c.appearance.appSize);
    return m.w <= p.layout.w && m.h <= p.layout.h;
  });
}
export function newPane(c: Config, title = "", apps: App[] = []): Pane {
  const p: Pane = {
    id: uid(),
    type: "pane",
    title,
    apps: [],
    layout: { x: 0, y: 0, w: 1, h: 1 },
  };
  const cols = Math.min(4, Math.max(1, apps.length));
  p.apps = apps.map((a, i) => ({
    ...a,
    id: uid(),
    col: i % cols,
    row: Math.floor(i / cols),
  }));
  const m = minimum(p, c.dashboard.width, c.appearance.appSize);
  p.layout = freePosition(c.items, Math.max(m.w, 8), Math.max(m.h, 7));
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
    const cap = capacity(p.layout, n.dashboard.width, n.appearance.appSize);
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
