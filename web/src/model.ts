import {
  type Background,
  type Glass,
  type Palette,
  type UiFont,
  logoReference,
  normaliseAppearanceFont,
  uiFonts,
  validateVisuals,
} from "./appearance";
import { builtinIconIds, type BuiltinIconId } from "./brandIcons";
import { fail } from "./validation";

export type Geometry = { x: number; y: number; w: number; h: number };

/** Shared app catalogue entry (name, URL, icon). */
export type AppDefinition = {
  id: string;
  name: string;
  url: string;
  icon: string;
  openInNewTab: boolean;
  source?: { provider: "docker"; id: string };
};

/** Placement of an app inside a pane (references AppDefinition). */
export type AppPlacement = {
  id: string;
  appId: string;
  col: number;
  row: number;
};

export type Pane = {
  id: string;
  type: "pane";
  title: string;
  layout: Geometry;
  apps: AppPlacement[];
};

export type Space = {
  id: string;
  name: string;
  items: Pane[];
};

export type Config = {
  version: 4;
  dashboardId: string;
  dashboard: {
    title: string;
    showTitle?: boolean;
    showIcon?: boolean;
    logo?: string;
    icon?: string;
    builtinIcon?: BuiltinIconId;
    widthMode: "fixed" | "full";
    width: number;
  };
  appearance: {
    showAppLabels: boolean;
    showButtonLabels: boolean;
    theme: "dark" | "light";
    paneTitleSize?: number;
    fontFamily?: UiFont;
    background?: Background;
    glass?: Partial<Glass> & Pick<Glass, "mode" | "opacity" | "blur">;
    palette?: Palette;
  };
  defaultSpaceId: string;
  apps: AppDefinition[];
  spaces: Space[];
};

/** Resolved app for rendering and editors (definition + placement). */
export type App = AppDefinition & {
  placementId: string;
  col: number;
  row: number;
};

export const tileSize = { icon: 80, w: 104, h: 120 };
// An 8px placement grid is a library adapter, not stored pane capacity.
// Frames include 8px on every edge, 32px for the external title, and 12px panel padding.
export const GRID = 8;
export const SNAP = 2; // 16px movement; retain schema-2 coordinates for existing layouts.
export const MAX_ROWS = 4096;
export const MAX_SPACES = 12;
export const MAX_SPACE_NAME = 48;
export const MAX_PANES = 100;
export const MAX_DEFINITIONS = 2000;
export const MAX_PLACEMENTS = 2000;
export const MAX_PLACEMENTS_PER_PANE = 500;

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

/** Unicode code-point length (not UTF-16 code units). */
export function codePointLength(s: string): number {
  return [...s].length;
}

/** Case-insensitive trimmed name key shared with Go. */
export function spaceNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("en-AU");
}

export function getSpace(c: Config, spaceId: string): Space {
  const s = c.spaces.find((x) => x.id === spaceId);
  if (!s) throw Error("This space no longer exists.");
  return s;
}

export function getAppDefinition(c: Config, appId: string): AppDefinition {
  const a = c.apps.find((x) => x.id === appId);
  if (!a) throw Error("This app no longer exists.");
  return a;
}

export function resolvePlacement(c: Config, placement: AppPlacement): App {
  const def = getAppDefinition(c, placement.appId);
  return {
    ...def,
    placementId: placement.id,
    col: placement.col,
    row: placement.row,
  };
}

export function resolvePaneApps(c: Config, pane: Pane): App[] {
  return pane.apps.map((p) => resolvePlacement(c, p));
}

export function placementCount(c: Config, appId: string): number {
  let n = 0;
  for (const s of c.spaces)
    for (const p of s.items)
      for (const a of p.apps) if (a.appId === appId) n++;
  return n;
}

export function updateSpace(
  current: Config,
  spaceId: string,
  update: (space: Space) => Space,
): Config {
  const index = current.spaces.findIndex((s) => s.id === spaceId);
  if (index < 0) throw Error("This space no longer exists.");
  const next = clone(current);
  next.spaces[index] = update(next.spaces[index]);
  validate(next);
  return next;
}

export function duplicateSpace(source: Space, name: string): Space {
  return {
    id: uid(),
    name,
    items: source.items.map((pane) => ({
      ...structuredClone(pane),
      id: uid(),
      apps: pane.apps.map((slot) => ({ ...slot, id: uid() })),
    })),
  };
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
    fail("", "unknown_fields", "Unknown or malformed configuration fields.");
};
const integer = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;

function validateSpaceName(name: unknown, path: string) {
  if (typeof name !== "string" || !name.trim())
    fail(path, "invalid_space_name", "Enter a space name.");
  if (codePointLength(name.trim()) > MAX_SPACE_NAME)
    fail(path, "invalid_space_name", `Space names can be at most ${MAX_SPACE_NAME} characters.`);
}

function validatePaneList(
  items: Pane[],
  width: number,
  path: string,
  paneIds: Set<string>,
  placementIds: Set<string>,
  definitionIds: Set<string>,
  totals: { panes: number; placements: number },
) {
  for (const [i, p] of items.entries()) {
    keys(p, ["id", "type", "title", "layout", "apps"]);
    keys(p.layout, ["x", "y", "w", "h"]);
    if (
      typeof p.id !== "string" ||
      !id.test(p.id) ||
      paneIds.has(p.id) ||
      p.type !== "pane" ||
      !text(p.title, 100)
    )
      fail(path, "invalid_pane", "Invalid pane identity or title.");
    paneIds.add(p.id);
    totals.panes++;
    if (totals.panes > MAX_PANES)
      fail("spaces", "too_many_panes", `At most ${MAX_PANES} panes are supported across all spaces.`);
    const g = p.layout;
    if (
      !integer(g.x, 0, 479) ||
      !integer(g.y, 0, MAX_ROWS - 1) ||
      !integer(g.w, 1, 32) ||
      !integer(g.h, 1, 32) ||
      (g.x + frame(g).w) * GRID > width ||
      g.y + frame(g).h > MAX_ROWS ||
      items.slice(0, i).some((other) => overlaps(frame(other.layout), frame(g)))
    )
      fail(path, "invalid_layout", "Panes must stay within the grid and cannot overlap.");
    if (!Array.isArray(p.apps) || p.apps.length > MAX_PLACEMENTS_PER_PANE)
      fail(path, "too_many_apps", "Too many apps.");
    if (g.w < 1 || g.h < 1)
      fail(path, "pane_too_small", "Pane is too small for an app cell.");
    const slots = new Set<string>();
    for (const a of p.apps) {
      keys(a, ["id", "appId", "col", "row"]);
      if (
        typeof a.id !== "string" ||
        !id.test(a.id) ||
        placementIds.has(a.id) ||
        typeof a.appId !== "string" ||
        !id.test(a.appId) ||
        !definitionIds.has(a.appId)
      )
        fail(path, "invalid_placement", "Invalid app placement.");
      placementIds.add(a.id);
      totals.placements++;
      if (totals.placements > MAX_PLACEMENTS)
        fail("spaces", "too_many_placements", `At most ${MAX_PLACEMENTS} app placements are supported.`);
      const slot = `${a.col}:${a.row}`;
      if (
        !integer(a.col, 0, g.w - 1) ||
        !integer(a.row, 0, g.h - 1) ||
        slots.has(slot)
      )
        fail(
          path,
          "occupied_slot",
          "A pane would clip an app or has an occupied slot. Move apps or enlarge the pane first.",
        );
      slots.add(slot);
    }
  }
}

export function validate(value: unknown): asserts value is Config {
  keys(value, [
    "version",
    "dashboardId",
    "dashboard",
    "appearance",
    "defaultSpaceId",
    "apps",
    "spaces",
  ]);
  const c = value as Config;
  keys(c.dashboard, [
    "title",
    "showTitle",
    "showIcon",
    "logo",
    "icon",
    "builtinIcon",
    "widthMode",
    "width",
  ]);
  keys(c.appearance, [
    "showAppLabels",
    "showButtonLabels",
    "theme",
    "paneTitleSize",
    "fontFamily",
    "background",
    "glass",
    "palette",
  ]);
  c.appearance = normaliseAppearanceFont(c.appearance);
  if (
    c.version !== 4 ||
    typeof c.dashboardId !== "string" ||
    !id.test(c.dashboardId) ||
    !text(c.dashboard.title, 100) ||
    (c.dashboard.logo !== undefined && !logoReference(c.dashboard.logo)) ||
    (c.dashboard.icon !== undefined && !logoReference(c.dashboard.icon)) ||
    (c.dashboard.showTitle !== undefined &&
      typeof c.dashboard.showTitle !== "boolean") ||
    (c.dashboard.showIcon !== undefined &&
      typeof c.dashboard.showIcon !== "boolean") ||
    (c.dashboard.builtinIcon !== undefined &&
      !(builtinIconIds as readonly string[]).includes(c.dashboard.builtinIcon)) ||
    !["fixed", "full"].includes(c.dashboard.widthMode)
  )
    fail("dashboard", "unsupported_dashboard", "Unsupported version or dashboard settings.");
  if (!integer(c.dashboard.width, 768, 3840))
    fail("dashboard.width", "invalid_width", "Dashboard width must be a whole number from 768 to 3840.");
  if (!["dark", "light"].includes(c.appearance.theme))
    fail("appearance", "invalid_appearance", "Invalid appearance settings.");
  if (
    c.appearance.paneTitleSize !== undefined &&
    !integer(c.appearance.paneTitleSize, 14, 22)
  )
    fail("appearance.paneTitleSize", "invalid_pane_title_size", "Pane title size must be a whole number from 14 to 22.");
  if (
    c.appearance.fontFamily !== undefined &&
    !uiFonts.some((f) => f.id === c.appearance.fontFamily)
  )
    fail("appearance.fontFamily", "invalid_font", "Choose Geist, Rubik or Oxanium.");
  if (
    typeof c.appearance.showAppLabels !== "boolean" ||
    typeof c.appearance.showButtonLabels !== "boolean"
  )
    fail("appearance", "invalid_appearance", "Invalid appearance settings.");
  validateVisuals(c.appearance);

  if (!Array.isArray(c.apps) || c.apps.length > MAX_DEFINITIONS)
    fail("apps", "too_many_apps", `At most ${MAX_DEFINITIONS} app definitions are supported.`);
  const definitionIds = new Set<string>();
  for (const a of c.apps) {
    keys(a, ["id", "name", "url", "icon", "openInNewTab", "source"]);
    if (
      typeof a.id !== "string" ||
      !id.test(a.id) ||
      definitionIds.has(a.id) ||
      !text(a.name, 100) ||
      !a.name ||
      typeof a.openInNewTab !== "boolean"
    )
      fail("apps", "invalid_app", "Invalid app identity or name.");
    definitionIds.add(a.id);
    if (
      !text(a.url, 2048) ||
      !validURL(a.url) ||
      !text(a.icon, 2048) ||
      (a.icon &&
        !/^dashboard-icons:[a-z0-9][a-z0-9-]{0,100}$/.test(a.icon) &&
        !validURL(a.icon, false))
    )
      fail("apps", "invalid_url", "Use HTTP(S) addresses without credentials.");
    if (a.source) {
      keys(a.source, ["provider", "id"]);
      if (
        a.source.provider !== "docker" ||
        !text(a.source.id, 500) ||
        !a.source.id
      )
        fail("apps", "invalid_source", "Invalid source identity.");
    }
  }

  if (!Array.isArray(c.spaces) || c.spaces.length < 1 || c.spaces.length > MAX_SPACES)
    fail("spaces", "invalid_spaces", `Provide between 1 and ${MAX_SPACES} spaces.`);
  if (typeof c.defaultSpaceId !== "string" || !id.test(c.defaultSpaceId))
    fail("defaultSpaceId", "invalid_default_space", "Choose a valid default space.");
  const spaceIds = new Set<string>();
  const nameKeys = new Set<string>();
  const paneIds = new Set<string>();
  const placementIds = new Set<string>();
  const totals = { panes: 0, placements: 0 };
  for (const [si, s] of c.spaces.entries()) {
    keys(s, ["id", "name", "items"]);
    if (typeof s.id !== "string" || !id.test(s.id) || spaceIds.has(s.id))
      fail("spaces", "invalid_space", "Invalid space identity.");
    spaceIds.add(s.id);
    validateSpaceName(s.name, `spaces.${si}.name`);
    const nk = spaceNameKey(s.name);
    if (nameKeys.has(nk))
      fail("spaces", "duplicate_space_name", "Space names must be unique.");
    nameKeys.add(nk);
    if (!Array.isArray(s.items))
      fail("spaces", "invalid_space", "Invalid space layout.");
    validatePaneList(
      s.items,
      c.dashboard.width,
      `spaces.${si}.items`,
      paneIds,
      placementIds,
      definitionIds,
      totals,
    );
  }
  if (!spaceIds.has(c.defaultSpaceId))
    fail("defaultSpaceId", "invalid_default_space", "Default space must exist.");
}

export function canPresent(c: Config, width: number, spaceId?: string) {
  const spaces = spaceId
    ? [getSpace(c, spaceId)]
    : c.spaces;
  return spaces.every((s) =>
    s.items.every((p) => (p.layout.x + frame(p.layout).w) * GRID <= width),
  );
}

export function newPane(
  items: Pane[],
  width: number,
  title = "",
  placements: AppPlacement[] = [],
): Pane {
  const p: Pane = {
    id: uid(),
    type: "pane",
    title,
    apps: [],
    layout: { x: 0, y: 0, w: 1, h: 1 },
  };
  const cols = 4;
  p.apps = placements.map((a, i) => ({
    ...a,
    id: a.id || uid(),
    col: i % cols,
    row: Math.floor(i / cols),
  }));
  const m = minimum(p);
  p.layout = freePosition(items, 4, m.h, width);
  return p;
}

/** @deprecated Prefer newPane(items, width, …) — kept for call-site migration. */
export function newPaneInConfig(c: Config, spaceId: string, title = "", placements: AppPlacement[] = []): Pane {
  return newPane(getSpace(c, spaceId).items, c.dashboard.width, title, placements);
}

export function moveApp(
  c: Config,
  spaceId: string,
  placementId: string,
  paneId: string,
  col: number,
  row: number,
) {
  return updateSpace(c, spaceId, (space) => {
    const n = clone(space);
    let placement: AppPlacement | undefined;
    for (const p of n.items) {
      placement ??= p.apps.find((a) => a.id === placementId);
      p.apps = p.apps.filter((a) => a.id !== placementId);
    }
    const target = n.items.find((p) => p.id === paneId);
    if (!placement || !target) throw Error("App or pane no longer exists.");
    target.apps.push({ ...placement, col, row });
    return n;
  });
}

export function importApps(
  c: Config,
  spaceId: string,
  definitions: AppDefinition[],
  destination: string,
  title: string,
) {
  const n = clone(c);
  const space = getSpace(n, spaceId);
  const spaceIndex = n.spaces.findIndex((s) => s.id === spaceId);
  let paneId: string;
  if (destination === "new") {
    const placements: AppPlacement[] = definitions.map((d) => ({
      id: uid(),
      appId: d.id,
      col: 0,
      row: 0,
    }));
    for (const d of definitions) {
      if (!n.apps.some((a) => a.id === d.id)) n.apps.push(d);
    }
    const p = newPane(space.items, n.dashboard.width, title, placements);
    // Fix cols/rows after newPane remapped by index
    const cols = 4;
    p.apps = definitions.map((d, i) => ({
      id: uid(),
      appId: d.id,
      col: i % cols,
      row: Math.floor(i / cols),
    }));
    const m = minimum(p);
    p.layout = freePosition(space.items, 4, m.h, n.dashboard.width);
    n.spaces[spaceIndex] = { ...space, items: [...space.items, p] };
    paneId = p.id;
  } else {
    const p = space.items.find((x) => x.id === destination);
    if (!p) throw Error("Choose a destination pane.");
    const slots: { col: number; row: number }[] = [];
    for (let row = 0; row < p.layout.h; row++)
      for (let col = 0; col < p.layout.w; col++)
        if (!p.apps.some((a) => a.col === col && a.row === row))
          slots.push({ col, row });
    if (slots.length < definitions.length)
      throw Error(
        "Not enough empty slots. Enlarge the pane or create a new one.",
      );
    for (const d of definitions) {
      if (!n.apps.some((a) => a.id === d.id)) n.apps.push(d);
    }
    const nextItems = space.items.map((item) => {
      if (item.id !== destination) return item;
      return {
        ...item,
        apps: [
          ...item.apps,
          ...definitions.map((d, i) => ({
            id: uid(),
            appId: d.id,
            ...slots[i],
          })),
        ],
      };
    });
    n.spaces[spaceIndex] = { ...space, items: nextItems };
    paneId = destination;
  }
  validate(n);
  return { config: n, paneId };
}

export function sanitiseExport(c: Config) {
  const n = clone(c);
  for (const a of n.apps) {
    a.url = "";
    delete a.source;
  }
  return n;
}

export function defaultConfig(): Config {
  const homeId = "home";
  return {
    version: 4,
    dashboardId: uid(),
    dashboard: {
      title: "pane.",
      showTitle: true,
      showIcon: true,
      widthMode: "fixed",
      width: 960,
    },
    appearance: {
      showAppLabels: true,
      showButtonLabels: true,
      theme: "dark",
    },
    defaultSpaceId: homeId,
    apps: [],
    spaces: [{ id: homeId, name: "Home", items: [] }],
  };
}

/** Schema 3 shape used only at conversion boundaries. */
type ConfigV3 = {
  version: 3;
  dashboard: Config["dashboard"];
  appearance: Config["appearance"];
  items: {
    id: string;
    type: "pane";
    title: string;
    layout: Geometry;
    apps: {
      id: string;
      name: string;
      url: string;
      icon: string;
      col: number;
      row: number;
      openInNewTab: boolean;
      source?: { provider: "docker"; id: string };
    }[];
  }[];
};

function validateV3(value: unknown): asserts value is ConfigV3 {
  keys(value, ["version", "dashboard", "appearance", "items"]);
  const c = value as ConfigV3;
  if (c.version !== 3)
    fail("version", "unsupported_version", "Unsupported configuration version.");
  // Reuse dashboard/appearance checks via a temporary v4 wrapper after convert;
  // here only structure needed for conversion.
  if (!c.dashboard || !c.appearance || !Array.isArray(c.items))
    fail("", "unknown_fields", "Unknown or malformed configuration fields.");
  if (c.items.length > MAX_PANES)
    fail("items", "too_many_panes", `At most ${MAX_PANES} panes are supported.`);
  const ids = new Set<string>();
  let total = 0;
  for (const p of c.items) {
    keys(p, ["id", "type", "title", "layout", "apps"]);
    if (typeof p.id !== "string" || !id.test(p.id) || ids.has(p.id) || p.type !== "pane")
      fail("items", "invalid_pane", "Invalid pane identity or title.");
    ids.add(p.id);
    if (!Array.isArray(p.apps)) fail("items", "invalid_app", "Invalid app identity or name.");
    for (const a of p.apps) {
      keys(a, ["id", "name", "url", "icon", "col", "row", "openInNewTab", "source"]);
      if (typeof a.id !== "string" || !id.test(a.id) || ids.has(a.id))
        fail("items", "invalid_app", "Invalid app identity or name.");
      ids.add(a.id);
      total++;
      if (total > MAX_DEFINITIONS)
        fail("items", "too_many_apps", "Too many apps.");
    }
  }
}

/**
 * Convert a validated schema 3 config into schema 4 (one Home space).
 * Old app IDs become definition IDs; placement IDs are deterministic `plc-{appId}`.
 */
export function convertV3ToV4(value: unknown): Config {
  validateV3(value);
  const v3 = value as ConfigV3;
  const homeId = "home";
  const apps: AppDefinition[] = [];
  const items: Pane[] = [];
  for (const p of v3.items) {
    const placements: AppPlacement[] = [];
    for (const a of p.apps) {
      apps.push({
        id: a.id,
        name: a.name,
        url: a.url,
        icon: a.icon,
        openInNewTab: a.openInNewTab,
        ...(a.source ? { source: { ...a.source } } : {}),
      });
      placements.push({
        id: `plc-${a.id}`,
        appId: a.id,
        col: a.col,
        row: a.row,
      });
    }
    items.push({
      id: p.id,
      type: "pane",
      title: p.title,
      layout: { ...p.layout },
      apps: placements,
    });
  }
  const next: Config = {
    version: 4,
    dashboardId: uid(),
    dashboard: structuredClone(v3.dashboard),
    appearance: normaliseAppearanceFont(structuredClone(v3.appearance)),
    defaultSpaceId: homeId,
    apps,
    spaces: [{ id: homeId, name: "Home", items }],
  };
  validate(next);
  return next;
}

/** Decode unknown JSON/YAML-shaped value: accept v4, or convert v3. */
export function parseConfig(value: unknown): Config {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { version?: number }).version === 3
  )
    return convertV3ToV4(value);
  validate(value);
  return value as Config;
}
