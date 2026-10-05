import { describe, expect, it } from "vitest";
import {
  Config,
  Pane,
  capacity,
  clone,
  frame,
  freePosition,
  importApps,
  minimum,
  moveApp,
  newPane,
  sanitiseExport,
  validURL,
  validate,
  canPresent,
  slotsFromFrame,
} from "./model";
import { tileResize, paneSnap } from "./layout";
const base = (): Config => ({
  version: 2,
  dashboard: { title: "Home", widthMode: "fixed", width: 960 },
  appearance: { showAppLabels: true, showButtonLabels: true, theme: "dark" },
  items: [],
});
const pane = (): Pane => ({
  id: "media",
  type: "pane",
  title: "Media",
  layout: { x: 0, y: 0, w: 4, h: 1 },
  apps: [
    {
      id: "plex",
      name: "Plex",
      url: "https://plex.example.com",
      icon: "dashboard-icons:plex",
      col: 3,
      row: 0,
      openInNewTab: true,
    },
  ],
});
describe("tile dimensions and placement", () => {
  it("creates exactly four columns and one row without a title", () => {
    const c = base();
    const p = newPane(c);
    expect(p.title).toBe("");
    expect(capacity(p.layout)).toEqual({ cols: 4, rows: 1 });
    c.items.push(p);
    validate(c);
  });
  it("has fixed dimensions regardless of viewport, title and label settings", () => {
    const c = base();
    c.items = [pane()];
    for (const width of [960, 1200, 2000]) {
      c.dashboard.width = width;
      c.dashboard.widthMode = "full";
      c.appearance.showAppLabels = false;
      validate(c);
      expect(frame(c.items[0].layout)).toEqual({ x: 0, y: 0, w: 60, h: 24 });
      expect(canPresent(c, width)).toBe(true);
    }
  });
  it("places adjacent four-slot panes with 16px between panel edges", () => {
    const a = pane();
    const b = freePosition([a], 4, 1);
    expect(b).toEqual({ x: 60, y: 0, w: 4, h: 1 });
    expect(b.x * 8 + 8 - ((a.layout.x + frame(a.layout).w) * 8 - 8)).toBe(16);
  });
  it("reserves title space and gutter even for untitled panes", () => {
    expect(frame({ x: 0, y: 0, w: 1, h: 1 }).h * 8).toBe(32 + 16 + 24 + 120);
  });
  it("maps every allowed slot size exactly to and from the library grid", () => {
    for (let w = 1; w <= 32; w++)
      for (let h = 1; h <= 32; h++) {
        const g = { x: 3, y: 5, w, h };
        expect(slotsFromFrame(frame(g))).toEqual(g);
      }
  });
  it("blocks shrinking past occupied columns and rows", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].layout.w = 3;
    expect(() => validate(c)).toThrow(/clip/);
    c.items[0].layout.w = 4;
    c.items[0].apps[0].row = 1;
    expect(() => validate(c)).toThrow(/clip/);
  });
  it("minimum capacity follows occupied coordinates including deliberate gaps", () => {
    const p = pane();
    expect(minimum(p)).toEqual({ w: 4, h: 1 });
    p.apps[0].col = 1;
    expect(minimum(p)).toEqual({ w: 2, h: 1 });
  });
  it("rejects colliding gutters and workspace overflow", () => {
    const c = base();
    c.items = [
      pane(),
      { ...pane(), id: "other", apps: [], layout: { x: 59, y: 0, w: 4, h: 1 } },
    ];
    expect(() => validate(c)).toThrow(/overlap/);
    c.items[1].layout.x = 60;
    validate(c);
    c.dashboard.width = 952;
    expect(() => validate(c)).toThrow();
  });
  it("changes only the presentation decision on narrow screens", () => {
    const c = base();
    c.items = [pane()];
    const before = clone(c);
    expect(canPresent(c, 390)).toBe(false);
    expect(c).toEqual(before);
  });
  it("snaps resize increments and clamps to whole tiles at the wall", () => {
    const item = { i: "p", x: 0, y: 0, w: 60, h: 24, minW: 60, minH: 24 };
    const ctx = {
      cols: 120,
      maxRows: 4096,
      containerWidth: 960,
      containerHeight: 1000,
      rowHeight: 8,
      margin: [0, 0] as const,
      layout: [item],
    };
    expect(tileResize.constrainSize!(item, 70, 35, "se", ctx)).toEqual({
      w: 74,
      h: 40,
    });
    expect(tileResize.constrainSize!(item, 120, 24, "e", ctx)).toEqual({
      w: 116,
      h: 24,
    });
    expect(tileResize.constrainSize!(item, 20, 10, "se", ctx)).toEqual({
      w: 60,
      h: 24,
    });
    expect(paneSnap.constrainPosition!(item, 3, 5, ctx)).toEqual({
      x: 4,
      y: 6,
    });
    expect(paneSnap.constrainPosition!(item, 99, -2, ctx)).toEqual({
      x: 60,
      y: 0,
    });
    expect(
      paneSnap.constrainPosition!(item, 99, 5000, { ...ctx, cols: 119 }),
    ).toEqual({ x: 58, y: 4072 });
  });
});
describe("validation and imports", () => {
  it("accepts optional branding and title sizes while validating image URLs", () => {
    const c = base();
    validate(c);
    c.dashboard.logo = "https://example.com/logo.png";
    c.appearance.paneTitleSize = 22;
    validate(c);
    expect(sanitiseExport(c).dashboard.logo).toBe(c.dashboard.logo);
    for (const logo of [
      "javascript:alert(1)",
      "data:image/svg+xml,test",
      "https://user:password@example.com/image.png",
    ]) {
      expect(() =>
        validate({ ...c, dashboard: { ...c.dashboard, logo } }),
      ).toThrow();
    }
    for (const paneTitleSize of [0, 13, 23, 18.5]) {
      expect(() =>
        validate({ ...c, appearance: { ...c.appearance, paneTitleSize } }),
      ).toThrow(/Pane title size must be a whole number/);
    }
    c.appearance.fontFamily = "rubik";
    validate(c);
    const unknownFont = {
      ...c,
      appearance: { ...c.appearance, fontFamily: "inter" as "rubik" },
    };
    validate(unknownFont);
    expect(unknownFont.appearance.fontFamily).toBeUndefined();
    const emptyFont = {
      ...c,
      appearance: { ...c.appearance, fontFamily: "" as unknown as undefined },
    };
    validate(emptyFont);
    expect(emptyFont.appearance.fontFamily).toBeUndefined();
    expect(() =>
      validate({ ...c, dashboard: { ...c.dashboard, width: 0 } }),
    ).toThrow(/Dashboard width must be a whole number/);
  });
  it("rejects unknown fields, obsolete size presets and fractional dimensions", () => {
    const c = base();
    expect(() =>
      validate({ ...c, appearance: { ...c.appearance, appSize: "large" } }),
    ).toThrow();
    expect(() => validate({ ...c, version: 1 })).toThrow();
    c.items = [pane()];
    c.items[0].layout.w = 3.5;
    expect(() => validate(c)).toThrow();
  });
  it("rejects unsafe URLs and allows blank templates", () => {
    expect(validURL("")).toBe(true);
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,test",
      "http://user:pass@host",
    ])
      expect(validURL(u)).toBe(false);
  });
  it("does not swap or compact on an occupied drop", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].apps.push({ ...pane().apps[0], id: "other", col: 0 });
    const before = clone(c);
    expect(() => moveApp(c, "plex", "media", 0, 0)).toThrow(/occupied/);
    expect(c).toEqual(before);
  });
  it("moves apps across panes while preserving the other apps", () => {
    const c = base();
    c.items = [
      pane(),
      { ...pane(), id: "other", apps: [], layout: { x: 60, y: 0, w: 4, h: 1 } },
    ];
    const n = moveApp(c, "plex", "other", 1, 0);
    expect(n.items[0].apps).toHaveLength(0);
    expect(n.items[1].apps[0].col).toBe(1);
    expect(c.items[0].apps).toHaveLength(1);
  });
  it("imports into empty slots only and regenerates IDs", () => {
    const c = base();
    c.items = [pane()];
    const n = importApps(c, [pane().apps[0]], "media", "").config;
    expect(n.items[0].apps.map((a) => a.col)).toEqual([3, 0]);
    expect(n.items[0].apps[1].id).not.toBe("plex");
  });
  it("rejects imports without sufficient capacity atomically", () => {
    const c = base();
    c.items = [pane()];
    const before = clone(c);
    expect(() =>
      importApps(c, Array(4).fill(pane().apps[0]), "media", ""),
    ).toThrow(/empty slots/);
    expect(c).toEqual(before);
  });
  it("sizes a Docker import in four-column rows", () => {
    const c = base();
    const p = newPane(c, "", Array(9).fill(pane().apps[0]));
    expect(capacity(p.layout)).toEqual({ cols: 4, rows: 3 });
    c.items.push(p);
    validate(c);
  });
  it("removes private addresses and discovery identities from shared exports", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].apps[0].source = { provider: "docker", id: "private" };
    const n = sanitiseExport(c);
    expect(n.items[0].apps[0].url).toBe("");
    expect(n.items[0].apps[0].source).toBeUndefined();
    expect(c.items[0].apps[0].url).not.toBe("");
  });
});
