import { defaultConfig, type Config, type Pane, type AppDefinition } from "./model";

/** Stable schema-4 fixture for unit tests. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  const base = defaultConfig();
  base.dashboardId = "test-dashboard";
  return {
    ...base,
    ...overrides,
    dashboard: { ...base.dashboard, ...overrides.dashboard },
    appearance: { ...base.appearance, ...overrides.appearance },
    apps: overrides.apps ?? base.apps,
    spaces: overrides.spaces ?? base.spaces,
  };
}

export function testPane(partial?: Partial<Pane>): Pane {
  return {
    id: "media",
    type: "pane",
    title: "Media",
    layout: { x: 0, y: 0, w: 4, h: 1 },
    apps: [{ id: "plc-plex", appId: "plex", col: 3, row: 0 }],
    ...partial,
  };
}

export function testApp(partial?: Partial<AppDefinition>): AppDefinition {
  return {
    id: "plex",
    name: "Plex",
    url: "https://plex.example.com",
    icon: "dashboard-icons:plex",
    openInNewTab: true,
    ...partial,
  };
}

export function populatedConfig(): Config {
  return testConfig({
    dashboard: {
      title: "Home",
      widthMode: "fixed",
      width: 960,
      showTitle: true,
      showIcon: true,
    },
    apps: [testApp()],
    spaces: [{ id: "home", name: "Home", items: [testPane()] }],
  });
}
