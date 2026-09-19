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
const initial = (): Config => ({
  version: 1,
  dashboard: { title: "Home", widthMode: "fixed", width: 960 },
  appearance: {
    appSize: "medium",
    showAppLabels: true,
    showButtonLabels: true,
    theme: "dark",
  },
  items: [
    {
      id: "media",
      type: "pane",
      title: "Media",
      layout: { x: 0, y: 0, w: 11, h: 10 },
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
    fireEvent.click(screen.getByRole("button", { name: "Add pane" }));
    expect(screen.getByRole("button", { name: "Done editing" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Edit pane" })).toBeTruthy();
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
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pane" }));
    expect(screen.getByRole("alert").textContent).toContain("clip");
    expect(screen.getByRole("dialog", { name: "Edit pane" })).toBeTruthy();
  });
});
