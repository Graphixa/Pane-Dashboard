import { describe, expect, it } from "vitest";
import {
  Config,
  Pane,
  capacity,
  clone,
  freePosition,
  importApps,
  minimum,
  moveApp,
  newPane,
  sanitiseExport,
  validURL,
  validate,
} from "./model";
const base = (): Config => ({
  version: 1,
  dashboard: { title: "Home", widthMode: "fixed", width: 960 },
  appearance: {
    appSize: "medium",
    showAppLabels: true,
    showButtonLabels: true,
    theme: "dark",
  },
  items: [],
});
const pane = (): Pane => ({
  id: "media",
  type: "pane",
  title: "Media",
  layout: { x: 0, y: 0, w: 11, h: 10 },
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
describe("configuration invariants", () => {
  it("preserves deliberate inner gaps", () => {
    const c = base();
    c.items = [pane()];
    expect(() => validate(c)).not.toThrow();
    expect(c.items[0].apps[0].col).toBe(3);
  });
  it("blocks shrinking past the fourth app column", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].layout.w = 8;
    expect(() => validate(c)).toThrow(/clip/);
  });
  it("blocks overlapping panes without moving neighbours", () => {
    const c = base();
    c.items = [pane(), { ...pane(), id: "other", apps: [] }];
    expect(() => validate(c)).toThrow(/overlap/);
  });
  it("rejects duplicate IDs and occupied app slots", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].apps.push({ ...c.items[0].apps[0], id: "other" });
    expect(() => validate(c)).toThrow(/occupied/);
    c.items[0].apps[1].col = 0;
    c.items[0].apps[1].id = "plex";
    expect(() => validate(c)).toThrow(/identity/);
  });
  it("blocks a global size increase that clips apps", () => {
    const c = base();
    c.items = [pane()];
    c.appearance.appSize = "large";
    expect(() => validate(c)).toThrow(/clip/);
  });
  it("rejects unknown fields and fractional geometry", () => {
    const c = base();
    expect(() => validate({ ...c, surprise: true })).toThrow();
    c.items = [pane()];
    c.items[0].layout.x = 0.5;
    expect(() => validate(c)).toThrow();
  });
  it("rejects unsupported item types", () => {
    const c = base();
    expect(() =>
      validate({ ...c, items: [{ ...pane(), type: "widget" }] }),
    ).toThrow();
  });
  it("allows a blank imported URL, rejects unsafe schemes and credentials", () => {
    expect(validURL("")).toBe(true);
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,test",
      "http://user:pass@host",
    ])
      expect(validURL(u)).toBe(false);
    expect(validURL("http://192.168.1.10:8989")).toBe(true);
  });
});
describe("geometry and imports", () => {
  it("minimum dimensions contain all occupied slots", () => {
    for (const size of ["small", "medium", "large"] as const)
      for (const width of [768, 960, 1200, 3840]) {
        const p = pane();
        const min = minimum(p, width, size);
        const cap = capacity({ ...p.layout, ...min }, width, size);
        expect(cap.cols).toBeGreaterThanOrEqual(4);
        expect(cap.rows).toBeGreaterThanOrEqual(1);
      }
  });
  it("first-free placement preserves gaps", () => {
    expect(freePosition([pane()], 8, 7)).toEqual({ x: 11, y: 0, w: 8, h: 7 });
  });
  it("moves across panes without swapping", () => {
    const c = base();
    c.items = [
      pane(),
      {
        ...pane(),
        id: "other",
        layout: { x: 11, y: 0, w: 11, h: 10 },
        apps: [],
      },
    ];
    const n = moveApp(c, "plex", "other", 0, 0);
    expect(n.items[0].apps).toHaveLength(0);
    expect(n.items[1].apps[0].col).toBe(0);
    expect(c.items[0].apps).toHaveLength(1);
  });
  it("fills only empty slots on import", () => {
    const c = base();
    c.items = [pane()];
    const n = importApps(c, [pane().apps[0]], "media", "").config;
    expect(n.items[0].apps.map((a) => a.col)).toEqual([3, 0]);
    expect(n.items[0].apps[1].id).not.toBe("plex");
  });
  it("fails an oversized import atomically", () => {
    const c = base();
    c.items = [pane()];
    const before = clone(c);
    expect(() =>
      importApps(c, Array(100).fill(pane().apps[0]), "media", ""),
    ).toThrow(/empty slots/);
    expect(c).toEqual(before);
  });
  it("creates a correctly sized optional-title pane", () => {
    const c = base();
    const p = newPane(c, "", Array(12).fill(pane().apps[0]));
    c.items.push(p);
    expect(() => validate(c)).not.toThrow();
    expect(p.title).toBe("");
  });
  it("strips private URLs and discovery identity without changing original", () => {
    const c = base();
    c.items = [pane()];
    c.items[0].apps[0].source = { provider: "docker", id: "host:service" };
    const n = sanitiseExport(c);
    expect(n.items[0].apps[0].url).toBe("");
    expect(n.items[0].apps[0].source).toBeUndefined();
    expect(c.items[0].apps[0].url).not.toBe("");
  });
});
