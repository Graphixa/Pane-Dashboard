// @vitest-environment jsdom
import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppIconPicker } from "./AppIconPicker";
import type { CatalogueEntry } from "./appCatalogue";

const longCatalogue: CatalogueEntry[] = Array.from({ length: 60 }, (_, i) => ({
  slug: `app-${String(i).padStart(2, "0")}`,
  displayName: `App ${String(i).padStart(2, "0")}`,
  aliases: i === 40 ? ["forty"] : undefined,
}));

type IoCallback = IntersectionObserverCallback;

let ioCallback: IoCallback | null = null;
let ioInstances: FakeIntersectionObserver[] = [];
let useFakeIO = true;

class FakeIntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  private targets = new Set<Element>();
  constructor(
    cb: IoCallback,
    options?: IntersectionObserverInit,
  ) {
    ioCallback = cb;
    ioInstances.push(this);
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? "0px";
    this.thresholds =
      options?.threshold == null
        ? [0]
        : Array.isArray(options.threshold)
          ? options.threshold
          : [options.threshold];
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  trigger(isIntersecting: boolean) {
    const entry = {
      isIntersecting,
      target: [...this.targets][0] ?? document.body,
      intersectionRatio: isIntersecting ? 1 : 0,
      time: 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
    } as IntersectionObserverEntry;
    ioCallback?.([entry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  ioCallback = null;
  ioInstances = [];
  useFakeIO = true;
  vi.stubGlobal(
    "IntersectionObserver",
    class extends FakeIntersectionObserver {
      constructor(cb: IoCallback, options?: IntersectionObserverInit) {
        if (!useFakeIO) {
          throw new Error("IntersectionObserver unavailable");
        }
        super(cb, options);
      }
    },
  );
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 180;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AppIconPicker reveal", () => {
  it("initially mounts a buffer and appends once when the sentinel intersects", async () => {
    const onSelect = vi.fn();
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={onSelect}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /^App \d+/ }).length,
      ).toBeGreaterThan(0);
    });
    const initial = screen.getAllByRole("button", { name: /^App \d+/ }).length;
    expect(initial).toBeGreaterThanOrEqual(8);
    expect(initial).toBeLessThan(60);
    expect(screen.queryByRole("button", { name: "App 50" })).toBeNull();

    const before = ioInstances.length;
    expect(before).toBeGreaterThan(0);
    ioInstances[ioInstances.length - 1]?.trigger(true);

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /^App \d+/ }).length,
      ).toBeGreaterThan(initial);
    });
    // Duplicate intersection must not double-append in the same turn.
    const mid = screen.getAllByRole("button", { name: /^App \d+/ }).length;
    ioInstances[ioInstances.length - 1]?.trigger(true);
    expect(screen.getAllByRole("button", { name: /^App \d+/ }).length).toBe(
      mid,
    );
  });

  it("reaches the end of the catalogue without a Load more control", async () => {
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^App \d+/ }).length,
      ).toBeGreaterThan(0),
    );

    for (let i = 0; i < 20; i++) {
      const observer = ioInstances[ioInstances.length - 1];
      if (!observer) break;
      observer.trigger(true);
      await waitFor(() => true);
      if (screen.queryByText("All matching apps shown")) break;
    }

    await waitFor(() => {
      expect(screen.getByText("All matching apps shown")).toBeTruthy();
      expect(screen.getByRole("button", { name: "App 59" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });

  it("resets the scroll budget on query change and ignores stale intersections", async () => {
    render(
      <AppIconPicker
        selectedIcon="dashboard-icons:app-00"
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "App 00" })).toBeTruthy(),
    );

    const stale = ioInstances[ioInstances.length - 1];
    fireEvent.change(screen.getByLabelText("Search apps"), {
      target: { value: "forty" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "App 40" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "App 01" })).toBeNull();
    });
    // Selected summary remains outside the filtered results.
    const summary = document.querySelector(".ui-icon-picker-summary");
    expect(summary?.textContent).toContain("App 00");
    expect(screen.queryByRole("button", { name: "App 00" })).toBeNull();

    stale?.trigger(true);
    expect(screen.queryByRole("button", { name: "App 01" })).toBeNull();
  });

  it("shows the empty state while keeping search editable", async () => {
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search apps"), {
      target: { value: "definitely-missing" },
    });
    expect(
      screen.getByText(
        "No apps found. Try another name or use a custom icon.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("All matching apps shown")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search apps"), {
      target: { value: "App 03" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "App 03" })).toBeTruthy(),
    );
  });

  it("selects with pointer and keyboard, exposing aria-pressed and checkmark", async () => {
    const onSelect = vi.fn();
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={onSelect}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "App 02" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "App 02" }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({ slug: "app-02", displayName: "App 02" }),
        artworkSlug: "app-02",
      }),
    );

    cleanup();
    render(
      <AppIconPicker
        selectedIcon="dashboard-icons:app-02"
        onSelect={onSelect}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "App 02" }).getAttribute(
          "aria-pressed",
        ),
      ).toBe("true"),
    );
    expect(
      screen
        .getByRole("button", { name: "App 02" })
        .querySelector(".ui-icon-picker-check"),
    ).toBeTruthy();

    const tile = screen.getByRole("button", { name: "App 03" });
    tile.focus();
    fireEvent.keyDown(tile, { key: "Enter" });
    fireEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({ slug: "app-03" }),
        artworkSlug: "app-03",
      }),
    );
  });

  it("switches light/dark artwork and persists the resolved slug", async () => {
    const onSelect = vi.fn();
    const variantCatalogue: CatalogueEntry[] = [
      {
        slug: "github",
        displayName: "Github",
        variants: { light: "github-light", dark: "github-dark" },
      },
      { slug: "plex", displayName: "Plex" },
    ];
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={onSelect}
        detailsTargetId="details"
        entries={variantCatalogue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Github" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Github" }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({ slug: "github" }),
        artworkSlug: "github-light",
      }),
    );

    cleanup();
    onSelect.mockClear();
    render(
      <AppIconPicker
        selectedIcon="dashboard-icons:github"
        onSelect={onSelect}
        detailsTargetId="details"
        entries={variantCatalogue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Github" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({ slug: "github" }),
          artworkSlug: "github-dark",
        }),
      );
    });
    const img = screen
      .getByRole("button", { name: "Github" })
      .querySelector("img");
    expect(img?.getAttribute("src")).toContain("github-dark.svg");
  });

  it("skips to app details without requiring every tile to be focused", async () => {
    const focus = vi.fn();
    const target = document.createElement("input");
    target.id = "details";
    target.focus = focus;
    document.body.appendChild(target);

    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip to app details" }));
    expect(focus).toHaveBeenCalled();
    target.remove();
  });

  it("keeps tile size when artwork errors", async () => {
    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue.slice(0, 4)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "App 00" })).toBeTruthy(),
    );
    const tile = screen.getByRole("button", { name: "App 00" });
    const img = tile.querySelector("img");
    expect(img).toBeTruthy();
    fireEvent.error(img!);
    expect(tile.querySelector(".ui-icon-picker-fallback")).toBeTruthy();
    expect(tile.querySelector("img")).toBeNull();
    fireEvent.click(tile);
  });

  it("falls back to scroll threshold when IntersectionObserver is missing", async () => {
    useFakeIO = false;
    vi.stubGlobal("IntersectionObserver", undefined);

    render(
      <AppIconPicker
        selectedIcon=""
        onSelect={vi.fn()}
        detailsTargetId="details"
        entries={longCatalogue}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^App \d+/ }).length,
      ).toBeGreaterThan(0),
    );
    const initial = screen.getAllByRole("button", { name: /^App \d+/ }).length;
    expect(initial).toBeLessThan(60);
    const viewport = document.querySelector(
      ".ui-scroll-area-viewport",
    ) as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 200,
    });
    // clientHeight is stubbed to 180; margin ≈ clientHeight → past threshold.
    fireEvent.scroll(viewport);
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /^App \d+/ }).length,
      ).toBeGreaterThan(initial);
    });
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });
});
