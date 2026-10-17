// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Dashboard from "./Dashboard";
import { Config } from "./model";

vi.mock("react-grid-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useContainerWidth: () => ({
    width: 1200,
    mounted: true,
    containerRef: { current: null },
  }),
}));
vi.mock("./design/components", async () => {
  const actual = await vi.importActual<typeof import("./design/components")>("./design/components");
  return {
    ...actual,
    DropdownMenu: ({ trigger, items }: { trigger: React.ReactElement; items: {label: string; disabled?: boolean; onSelect?: () => void}[] }) => <>{trigger}<div role="menu">{items.map(item => <button key={item.label} role="menuitem" disabled={item.disabled} onClick={item.onSelect}>{item.label}</button>)}</div></>,
  };
});
const initial = (): Config => ({
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
          icon: "",
          col: 3,
          row: 0,
          openInNewTab: true,
        },
      ],
    },
  ],
});
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url, options) =>
        new Response(
          JSON.stringify(
            options?.method === "PUT" ? { saved: true } : initial(),
          ),
          {
            status: 200,
            headers: {
              ETag: '"test-revision"',
              "Content-Type": "application/json",
            },
          },
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("interaction boundary", () => {
  it("saves custom branding and title sizing without the removed headings or footer", async () => {
    const result = render(<Dashboard />);
    await screen.findByRole("link", { name: "Home home" });
    expect(
      result.container.querySelector(".dashboard-heading, footer"),
    ).toBeNull();
    expect(screen.queryByText(/YOUR SPACE, CONNECTED/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Akira" },
    });
    fireEvent.click(screen.getByRole("button", { name: "From URL" }));
    fireEvent.change(screen.getByLabelText("Logo image URL"), {
      target: { value: "https://example.com/logo.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.change(screen.getByLabelText("Pane title size (px)"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    const brand = screen.getByRole("link", { name: "Akira home" });
    expect(brand.querySelector(".brand-logo")?.getAttribute("src")).toBe(
      "https://example.com/logo.png",
    );
    expect(brand.querySelector(".brand-name")).toBeNull();
    expect(document.title).toBe("Akira");
    expect(
      (
        result.container.querySelector(".shell") as HTMLElement
      ).style.getPropertyValue("--pane-title-size"),
    ).toBe("20px");
    fireEvent.error(brand.querySelector(".brand-logo")!);
    expect(brand.querySelector(".brand-logo")).toBeNull();
    expect(brand.querySelector(".brand-name")?.textContent).toBe("Akira");
    expect(brand.querySelector("svg")).not.toBeNull();
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([, o]) => o?.method === "PUT"),
      ).toBe(true),
    );
    const saved = JSON.parse(
      vi.mocked(fetch).mock.calls.find(([, o]) => o?.method === "PUT")![1]!
        .body as string,
    );
    expect(saved.dashboard).toMatchObject({
      title: "Akira",
      logo: "https://example.com/logo.png",
    });
    expect(saved.appearance.paneTitleSize).toBe(20);
  });
  it("keeps addressless apps non-launching with a useful tooltip", async () => {
    const c = initial();
    c.items[0].apps[0].url = "";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(c)));
    const result = render(<Dashboard />);
    await screen.findByRole("link", { name: "Home home" });
    const app = result.container.querySelector(
      '.app-link[aria-disabled="true"]',
    )!;
    expect(app.getAttribute("href")).toBeNull();
    expect(app.getAttribute("title")).toBe("Plex: address not configured");
    const artwork = app.querySelector(".artwork");
    expect(artwork).not.toBeNull();
    expect(getComputedStyle(artwork!).opacity).toBe("1");
    expect(getComputedStyle(app).opacity).toBe("1");
  });
  it("edits the external title inline without consuming slots", async () => {
    const result = render(<Dashboard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit dashboard" }),
    );
    expect(result.container.querySelector(".pane .pane-title")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit title: Media" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Pane title" }), {
      target: { value: "My dock" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Pane title" }));
    expect(
      screen.getByRole("button", { name: "Edit title: My dock" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(
      3,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit title: My dock" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Pane title" }), {
      target: { value: "Cancelled" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Pane title" }), {
      key: "Escape",
    });
    expect(
      screen.getByRole("button", { name: "Edit title: My dock" }),
    ).toBeTruthy();
  });
  it("keeps placeholders square and removes position/size preset settings", async () => {
    const result = render(<Dashboard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit dashboard" }),
    );
    expect(
      result.container.querySelectorAll(".empty-slot .placeholder-artwork"),
    ).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Edit Media" }));
    expect(screen.getByLabelText("Columns")).toBeTruthy();
    expect(screen.queryByLabelText("Left")).toBeNull();
    expect(screen.queryByLabelText("Top")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByLabelText("App size")).toBeNull();
  });
  it("moves the selected highlight and supports keyboard pane movement", async () => {
    const result = render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add pane" }));
    expect(
      result.container.querySelector(".focused")?.getAttribute("aria-label"),
    ).toBe("Untitled pane");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move Media" }));
    expect(
      result.container.querySelector(".focused")?.getAttribute("aria-label"),
    ).toBe("Media");
    fireEvent.keyDown(screen.getByRole("button", { name: "Move Media" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("alert").textContent).toContain("overlap");
  });
  it("read mode launches links and hides all app slots", async () => {
    render(<Dashboard />);
    await screen.findByRole("link", { name: "Plex" });
    expect(
      screen.queryAllByRole("button", { name: /Add app at/ }),
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Edit Media" })).toBeNull();
  });
  it("edit mode exposes slots and app editing; Done restores launch links", async () => {
    render(<Dashboard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit dashboard" }),
    );
    expect(
      screen.getAllByRole("button", { name: /Add app at/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Plex" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Plex" }));
    expect(
      await screen.findByRole("dialog", { name: "Edit app" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Done editing" }));
    expect(screen.getByRole("link", { name: "Plex" })).toBeTruthy();
  });
  it("adding a pane enters edit mode and autosaves with revision protection", async () => {
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add pane" }));
    expect(screen.getByRole("button", { name: "Done editing" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(
      7,
    );
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([, o]) => o?.method === "PUT"),
      ).toBe(true),
    );
    const write = vi
      .mocked(fetch)
      .mock.calls.find(([, o]) => o?.method === "PUT")!;
    expect((write[1]?.headers as Record<string, string>)["If-Match"]).toBe(
      '"test-revision"',
    );
  });
  it("rejects shrinking through an occupied column from the numeric editor", async () => {
    render(<Dashboard />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit dashboard" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Media" }));
    fireEvent.change(screen.getByLabelText("Columns"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pane" }));
    expect(screen.getByRole("alert").textContent).toContain("clip");
    expect(screen.getByRole("dialog", { name: "Edit pane" })).toBeTruthy();
  });
});
