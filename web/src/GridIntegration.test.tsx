// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Dashboard from "./Dashboard";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("measures the real grid after asynchronous config loading and locks narrow layouts", async () => {
  let width = 1200;
  const measure = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(() => width);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
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
                    url: "https://example.com",
                    icon: "",
                    col: 3,
                    row: 0,
                    openInNewTab: true,
                  },
                ],
              },
            ],
          }),
          { headers: { ETag: '"one"' } },
        ),
    ),
  );
  const result = render(<Dashboard />);
  await screen.findByRole("link", { name: "Plex" });
  await waitFor(() => expect(measure).toHaveBeenCalled());
  expect(result.container.querySelector(".react-grid-layout")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
  expect(
    result.container.querySelector(".react-resizable-handle-e"),
  ).not.toBeNull();
  cleanup();
  width = 390;
  const mobile = render(<Dashboard />);
  await screen.findByRole("link", { name: "Plex" });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Edit dashboard",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  expect(mobile.container.querySelector(".react-grid-layout")).toBeNull();
  expect(mobile.container.querySelector(".mobile-panes")).not.toBeNull();
});
