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
            version: 2,
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
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(3);
  const south = result.container.querySelector(".react-resizable-handle-s")!;
  fireEvent.mouseDown(south, { clientX: 240, clientY: 184, button: 0 });
  fireEvent.mouseMove(document, { clientX: 240, clientY: 312, buttons: 1 });
  // The live callback exposes a second row before releasing the pointer.
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(7);
  fireEvent.mouseUp(document, { clientX: 240, clientY: 312 });
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(7);
  const east = result.container.querySelector(".react-resizable-handle-e")!;
  fireEvent.mouseDown(east, { clientX: 472, clientY: 100, button: 0 });
  fireEvent.mouseMove(document, { clientX: 250, clientY: 100, buttons: 1 });
  fireEvent.mouseUp(document, { clientX: 250, clientY: 100 });
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("button", { name: "Add pane" }));
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(
    11,
  );
  fireEvent.mouseDown(east, { clientX: 472, clientY: 100, button: 0 });
  fireEvent.mouseMove(document, { clientX: 600, clientY: 100, buttons: 1 });
  fireEvent.mouseUp(document, { clientX: 600, clientY: 100 });
  expect(screen.getAllByRole("button", { name: /Add app at/ })).toHaveLength(
    11,
  );
  const move = screen.getByRole("button", { name: "Move Media" });
  // jsdom has no layout engine; supply the positioned parent used by RGL.
  Object.defineProperty(
    result.container.querySelector(".pane-grid-item"),
    "offsetParent",
    {
      configurable: true,
      value: result.container.querySelector(".react-grid-layout"),
    },
  );
  fireEvent.mouseDown(move, { clientX: 50, clientY: 10, button: 0 });
  fireEvent.mouseMove(document, { clientX: 50, clientY: 31, buttons: 1 });
  fireEvent.mouseUp(document, { clientX: 50, clientY: 31 });
  // Absolute strategy (top/left) so glass backdrop-filter can sample the page.
  expect(
    (result.container.querySelector(".pane-grid-item") as HTMLElement).style
      .top,
  ).toContain("32px");
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
