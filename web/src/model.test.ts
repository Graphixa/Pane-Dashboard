import { describe, expect, it } from "vitest";
import {
  Config,
  Pane,
  clone,
  convertV3ToV4,
  defaultConfig,
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

const base = (): Config => {
  const c = defaultConfig();
  c.dashboardId = "dash1";
  c.dashboard = { title: "Home", widthMode: "fixed", width: 960 };
  return c;
};

const pane = (): Pane => ({
  id: "media",
  type: "pane",
  title: "Media",
  layout: { x: 0, y: 0, w: 4, h: 1 },
  apps: [{ id: "plc-plex", appId: "plex", col: 3, row: 0 }],
});

function withPane(c: Config = base()): Config {
  const n = clone(c);
  n.apps = [
    {
      id: "plex",
      name: "Plex",
      url: "https://plex.example.com",
      icon: "dashboard-icons:plex",
      openInNewTab: true,
    },
  ];
  n.spaces[0].items = [pane()];
  return n;
}

describe("tile dimensions and placement", () => {
  it("creates exactly four columns and one row without a title", () => {
    const c = base();
    const p = newPane(c.spaces[0].items, c.dashboard.width);
    expect(p.title).toBe("");
    expect(p.layout.w).toBe(4);
    expect(p.layout.h).toBe(1);
    c.spaces[0].items.push(p);
    validate(c);
  });
  it("has fixed dimensions regardless of viewport, title and label settings", () => {
    const c = withPane();
    for (const width of [960, 1200, 2000]) {
      c.dashboard.width = width;
      c.dashboard.widthMode = "full";
      c.appearance.showAppLabels = false;
      validate(c);
      expect(frame(c.spaces[0].items[0].layout)).toEqual({
        x: 0,
        y: 0,
        w: 60,
        h: 24,
      });
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
    const c = withPane();
    c.spaces[0].items[0].layout.w = 3;
    expect(() => validate(c)).toThrow(/clip/);
    c.spaces[0].items[0].layout.w = 4;
    c.spaces[0].items[0].apps[0].row = 1;
    expect(() => validate(c)).toThrow(/clip/);
  });
  it("minimum capacity follows occupied coordinates including deliberate gaps", () => {
    const p = pane();
    expect(minimum(p)).toEqual({ w: 4, h: 1 });
    p.apps[0].col = 1;
    expect(minimum(p)).toEqual({ w: 2, h: 1 });
  });
  it("rejects colliding gutters and workspace overflow", () => {
    const c = withPane();
    c.spaces[0].items = [
      pane(),
      { ...pane(), id: "other", apps: [], layout: { x: 59, y: 0, w: 4, h: 1 } },
    ];
    expect(() => validate(c)).toThrow(/overlap|layout/);
    c.spaces[0].items[1].layout.x = 60;
    validate(c);
    c.dashboard.width = 952;
    expect(() => validate(c)).toThrow(/layout|overlap/);
  });
  it("allows the same coordinates in different spaces", () => {
    const c = withPane();
    c.spaces.push({
      id: "work",
      name: "Work",
      items: [
        {
          ...pane(),
          id: "media2",
          apps: [{ id: "plc-plex-2", appId: "plex", col: 3, row: 0 }],
        },
      ],
    });
    validate(c);
  });
});

describe("app movement and import", () => {
  it("moves an app between panes", () => {
    const c = withPane();
    c.spaces[0].items.push({
      id: "other",
      type: "pane",
      title: "",
      layout: { x: 60, y: 0, w: 4, h: 1 },
      apps: [],
    });
    const next = moveApp(c, "home", "plc-plex", "other", 0, 0);
    expect(next.spaces[0].items[0].apps).toHaveLength(0);
    expect(next.spaces[0].items[1].apps[0]).toMatchObject({
      id: "plc-plex",
      appId: "plex",
      col: 0,
      row: 0,
    });
  });
  it("imports apps into a new pane", () => {
    const c = base();
    const { config: next, paneId } = importApps(
      c,
      "home",
      [
        {
          id: "a1",
          name: "One",
          url: "https://one.example",
          icon: "",
          openInNewTab: true,
        },
      ],
      "new",
      "Imported",
    );
    expect(paneId).toBeTruthy();
    expect(next.apps).toHaveLength(1);
    expect(next.spaces[0].items[0].title).toBe("Imported");
  });
  it("strips private fields on export", () => {
    const c = withPane();
    c.apps[0].source = { provider: "docker", id: "abc" };
    const clean = sanitiseExport(c);
    expect(clean.apps[0].url).toBe("");
    expect(clean.apps[0].source).toBeUndefined();
    expect(c.apps[0].url).toBe("https://plex.example.com");
  });
});

describe("schema conversion", () => {
  it("converts schema 3 into one Home space", () => {
    const v4 = convertV3ToV4({
      version: 3,
      dashboard: { title: "Home", widthMode: "fixed", width: 960 },
      appearance: {
        showAppLabels: true,
        showButtonLabels: true,
        theme: "dark",
      },
      items: [
        {
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
        },
      ],
    });
    expect(v4.version).toBe(4);
    expect(v4.spaces[0].name).toBe("Home");
    expect(v4.apps[0].id).toBe("plex");
    expect(v4.spaces[0].items[0].apps[0].id).toBe("plc-plex");
    expect(v4.spaces[0].items[0].apps[0].col).toBe(3);
  });
});

describe("urls and layout helpers", () => {
  it("accepts http(s) without credentials", () => {
    expect(validURL("https://example.com")).toBe(true);
    expect(validURL("javascript:alert(1)")).toBe(false);
    expect(validURL("https://user:pass@example.com")).toBe(false);
  });
  it("exposes layout snap helpers", () => {
    expect(tileResize).toBeTruthy();
    expect(paneSnap).toBeTruthy();
  });
});
