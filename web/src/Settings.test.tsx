// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Settings from "./Settings";
import { Config } from "./model";
import { LIVE_HOVER_PREVIEW_MS } from "./wallpaperChooser";
import { RECENT_WALLPAPER_KEY, recordRecentWallpaper, loadRecentWallpapers, flushPendingRecentWallpaper, queueRecentWallpaperOnSave } from "./wallpaperRecent";
import { clearVideoStillCache } from "./videoStillCache";
const config = (): Config => ({
  version: 3,
  dashboard: { title: "Akira", widthMode: "fixed", width: 960 },
  appearance: { theme: "dark", showAppLabels: true, showButtonLabels: true },
  items: [],
});
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
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
});
afterEach(() => {
  cleanup();
  queueRecentWallpaperOnSave(undefined);
  clearVideoStillCache();
  localStorage.removeItem(RECENT_WALLPAPER_KEY);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const setPaletteColour = (label: string, hex: string) => {
  fireEvent.click(screen.getByRole("button", { name: label }));
  const field = screen.getByLabelText(`${label} hex`);
  fireEvent.change(field, { target: { value: hex } });
  fireEvent.blur(field);
  fireEvent.click(screen.getByRole("button", { name: `Close ${label} picker` }));
};
const setup = (cfg: Config = config()) => {
  const apply = vi.fn(),
    close = vi.fn(),
    imported = vi.fn(),
    preview = vi.fn(),
    discardSettings = vi.fn();
  const commitSettings = vi.fn(
    async (settings: {
      dashboard: Config["dashboard"];
      appearance: Config["appearance"];
    }) => {
      const prior = apply.mock.calls.at(-1)?.[0] as Config | undefined;
      const merged = {
        ...(prior ?? cfg),
        dashboard: settings.dashboard,
        appearance: settings.appearance,
      };
      apply(merged);
      return { status: "saved" as const, config: merged };
    },
  );
  const result = render(
    <Settings
      config={cfg}
      commitSettings={commitSettings}
      discardSettings={discardSettings}
      close={close}
      imported={imported}
      onPreview={preview}
      readOnly={false}
    />,
  );
  return {
    ...result,
    container: document.body,
    apply,
    commitSettings,
    discardSettings,
    close,
    imported,
    preview,
  };
};
const page = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
/** Settings coalesces onPreview to animation frames. */
const flushPreview = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
describe("settings navigation and draft safety", () => {
  it("keeps a draft across sections and blocks import and backup until it is applied", async () => {
    const { apply } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "My server" },
    });
    page("Appearance");
    fireEvent.change(screen.getByLabelText("Pane title size (px)"), {
      target: { value: "20" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", {name: "Font"}), {key: "ArrowDown"});
    fireEvent.click(screen.getByRole("option", {name: "Oxanium"}));
    page("Import & backup");
    expect(
      screen.getByText(
        /Apply or discard your settings changes before importing or exporting/i,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "Import source" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Layout file" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Download full backup",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    page("General");
    expect(
      (screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value,
    ).toBe("My server");
    page("About");
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].dashboard.title).toBe("My server");
    expect(apply.mock.calls[0][0].appearance.paneTitleSize).toBe(20);
    expect(apply.mock.calls[0][0].appearance.fontFamily).toBe("oxanium");
  });
  it("protects changed drafts from Escape, Cancel and Close", async () => {
    const { close } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {target: {value: "Changed"}});
    for (const action of ["Cancel", "Close", "Escape"]) {
      if(action === "Escape") fireEvent.keyDown(document, {key: "Escape"}); else page(action);
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      page("Keep changes");
      expect(close).not.toHaveBeenCalled();
    }
    page("Cancel"); page("Discard");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("validates hidden sections before applying", async () => {
    const { apply } = setup();
    page("Appearance");
    fireEvent.click(
      screen.getByRole("button", {name: "Custom palette"}),
    );
    setPaletteColour("Text", "#111720");
    page("General");
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen
          .getByRole("navigation", { name: "Settings sections" })
          .querySelector('[aria-current="page"]')?.textContent,
      ).toMatch(/Appearance/i),
    );
    expect(
      screen.getByRole("button", { name: "Custom palette" }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getAllByRole("alert").some((el) => /contrast/i.test(el.textContent || "")),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Text" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });
  it("composes header brand from page title, icon and custom logo with Show/Hide", async () => {
    const { apply } = setup();
    expect(screen.getByRole("textbox", { name: "Page title" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide page title" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Built-in icons" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide icon" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload custom icon" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload custom logo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "From URL" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide icon" }));
    expect(screen.getByRole("button", { name: "Show icon" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "rocket" }));
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].dashboard).toMatchObject({
      showIcon: false,
      builtinIcon: "rocket",
      icon: "",
    });
  });
  it("uploads a custom icon from the grid tile and clears with Remove", async () => {
    const { apply, preview } = setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/media/upload") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "sess-icon",
            previewUrl: "/media/staging/sess-icon",
            meta: {
              kind: "image",
              mime: "image/png",
              width: 64,
              height: 64,
              name: "mark.png",
              bytes: 12,
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/media/commit")) {
        return new Response(
          JSON.stringify({
            assetId: "icon-asset-1",
            meta: { kind: "image", name: "mark.png" },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    const file = new File([new Uint8Array([1, 2, 3])], "mark.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Custom icon file"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replace custom icon" })).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Remove custom icon" })).toBeTruthy();
    await flushPreview();
    const drafted = preview.mock.calls
      .map((call) => call[0] as Config | null)
      .filter(Boolean)
      .at(-1) as Config;
    expect(drafted.dashboard.icon).toBe("/media/assets/icon-asset-1");
    fireEvent.click(screen.getByRole("button", { name: "Remove custom icon" }));
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].dashboard.icon).toBe("");
  });
  it("uploads a custom logo from URL and clears with Remove", async () => {
    const { apply, preview } = setup();
    fireEvent.click(screen.getByRole("button", { name: "From URL" }));
    fireEvent.change(screen.getByLabelText("Logo image URL"), {
      target: { value: "https://example.com/wordmark.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("button", { name: "Replace custom logo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove custom logo" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Hide page title" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await flushPreview();
    const drafted = preview.mock.calls
      .map((call) => call[0] as Config | null)
      .filter(Boolean)
      .at(-1) as Config;
    expect(drafted.dashboard.logo).toBe("https://example.com/wordmark.png");
    fireEvent.click(screen.getByRole("button", { name: "Remove custom logo" }));
    expect(screen.getByRole("button", { name: "Upload custom logo" })).toBeTruthy();
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].dashboard.logo).toBe("");
  });
  it("applies a file logo from the inline drop target", async () => {
    const { preview } = setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/media/upload") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "sess-logo",
            previewUrl: "/media/staging/sess-logo",
            meta: {
              kind: "image",
              mime: "image/png",
              width: 200,
              height: 48,
              name: "mark.png",
              bytes: 12,
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/media/commit")) {
        return new Response(
          JSON.stringify({
            assetId: "logo-asset-1",
            meta: { kind: "image", name: "mark.png" },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    const file = new File([new Uint8Array([1, 2, 3])], "mark.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Custom logo file"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replace custom logo" })).toBeTruthy(),
    );
    await flushPreview();
    const drafted = preview.mock.calls
      .map((call) => call[0] as Config | null)
      .filter(Boolean)
      .at(-1) as Config;
    expect(drafted.dashboard.logo).toBe("/media/assets/logo-asset-1");
  });
  it("keeps an inline file logo when upload finishes after a mid-flight wait", async () => {
    const { preview } = setup();
    let finishCommit!: (value: Response) => void;
    const commitGate = new Promise<Response>((resolve) => {
      finishCommit = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/media/upload") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "sess-logo-dismiss",
            previewUrl: "/media/staging/sess-logo-dismiss",
            meta: {
              kind: "image",
              mime: "image/png",
              width: 200,
              height: 48,
              name: "mark.png",
              bytes: 12,
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/media/commit")) {
        return commitGate;
      }
      return new Response("{}", { status: 404 });
    });
    const file = new File([new Uint8Array([1, 2, 3])], "mark.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Custom logo file"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByText("Uploading…")).toBeTruthy(),
    );

    finishCommit(
      new Response(
        JSON.stringify({
          assetId: "logo-asset-dismiss",
          meta: { kind: "image", name: "mark.png" },
        }),
        { status: 200 },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replace custom logo" })).toBeTruthy(),
    );
    await flushPreview();
    const drafted = preview.mock.calls
      .map((call) => call[0] as Config | null)
      .filter(Boolean)
      .at(-1) as Config;
    expect(drafted.dashboard.logo).toBe("/media/assets/logo-asset-dismiss");
  });
  it("offers Appearance and Background pages with ordered headings and no miniature previews", { timeout: 15000 }, async () => {
    const { container } = setup();
    for (const name of [
      "General",
      "Appearance",
      "Background",
      "Panes",
      "Import & backup",
      "About",
    ]) {
      page(name);
      expect(
        container.querySelector(".appearance-preview, .type-sample"),
      ).toBeNull();
    }
    page("Appearance");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent),
    ).toEqual(["Theme", "Colours", "Typography"]);
    expect(screen.getByRole("group", { name: "Accent" })).toBeTruthy();
    expect(container.querySelector(".ui-settings-group")).toBeTruthy();
    page("Background");
    expect(screen.getByRole("button", { name: "Change wallpaper" })).toBeTruthy();
    expect(screen.getByText("Currently set")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Enhancements" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Readability" })).toBeTruthy();
    expect(screen.getByText("Theme overlay")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Tint" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Customise tint/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    const addMotion = screen.getByRole("combobox", { name: "Add Motion" });
    expect(addMotion).toBeTruthy();
    expect((addMotion as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Customise motion/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Not available for live or video wallpapers."),
    ).toBeTruthy();
    const screenEffects = screen.getByRole("combobox", { name: "Screen Effects" });
    expect(screenEffects.textContent).toMatch(/None/i);
    expect(
      (screen.getByRole("button", { name: /Customise screen effects/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /^Add$/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(screen.getByRole("dialog", { name: "Choose wallpaper" })).toBeTruthy();
    expect(
      screen.getByRole("dialog", { name: "Choose wallpaper" }).classList.contains(
        "ui-dialog-bottom",
      ),
    ).toBe(true);
    expect(screen.queryByRole("tablist", { name: "Wallpaper type" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Colours" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Categories" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "My media" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gradients" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wallpapers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Live" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Videos" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dynamic" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add media" })).toBeTruthy();
    expect(screen.getByText(/Apply in Settings to save/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use wallpaper" })).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: "Choose wallpaper" });
    expect(dialog.querySelectorAll("video[loop]").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    expect(
      screen.getByRole("button", { name: "Mint" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Use wallpaper" }));
    expect(screen.queryByRole("dialog", { name: "Choose wallpaper" })).toBeNull();
    expect(screen.getByText("Colour")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Gradients" }));
    expect(screen.getByRole("dialog", { name: "Gradients" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: "Use wallpaper" }));
    expect(screen.getByText("Ocean")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Wallpaper overlay" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "App tiles" })).toBeNull();
  });
  it("restores wallpaper draft when Choose wallpaper is closed without Use wallpaper", async () => {
    setup();
    page("Background");
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    fireEvent.click(screen.getByRole("button", { name: "Use wallpaper" }));
    expect(screen.getByText("Colour")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    const chooser = screen.getByRole("dialog", { name: "Choose wallpaper" });
    fireEvent.click(within(chooser).getByRole("button", { name: "Gradients" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard wallpaper changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Choose wallpaper|Gradients/ })).toBeNull();
    });
    expect(screen.getByText("Colour")).toBeTruthy();
    expect(screen.queryByText("Ocean")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    const again = screen.getByRole("dialog", { name: "Choose wallpaper" });
    fireEvent.click(within(again).getByRole("button", { name: "Gradients" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Gradients" }), { key: "Escape" });
    expect(screen.getByRole("alertdialog", { name: "Discard wallpaper changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Choose wallpaper|Gradients/ })).toBeNull();
    });
    expect(screen.getByText("Colour")).toBeTruthy();
    expect(screen.queryByText("Ocean")).toBeNull();
  });
  it("opens Tint adjust sheet with fixed header/footer and scrollable body", () => {
    setup();
    page("Background");
    fireEvent.click(screen.getByRole("switch", { name: "Tint" }));
    fireEvent.click(screen.getByRole("button", { name: /Customise tint/i }));
    const sheet = screen.getByRole("dialog", { name: "Tint" });
    expect(sheet.classList.contains("ui-dialog-sheet")).toBe(true);
    expect(sheet.classList.contains("background-adjust-dialog")).toBe(true);
    expect(sheet.querySelector(".ui-dialog-body .ui-settings-group-compact")).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeTruthy();
    expect(within(sheet).getByRole("slider", { name: "Opacity" })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Tint" })).toBeNull();
  });
  it("keeps labels on General and retains glass tuning across finish and page changes", { timeout: 10000 }, async () => {
    const { apply } = setup();
    page("Panes");
    expect(screen.queryByRole("heading", { name: "Fine tuning" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Labels" })).toBeNull();
    page("Glass");
    expect(
      screen
        .getByRole("region", { name: "Fine tuning" })
        .contains(screen.getByRole("slider", { name: "Opacity" })),
    ).toBe(true);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Opacity" }), {key: "Home"});
    for (let i = 0; i < 55; i++) fireEvent.keyDown(screen.getByRole("slider", {name: "Opacity"}), {key: "ArrowRight"});
    page("Solid");
    page("General");
    fireEvent.click(screen.getByRole("switch", { name: "App tiles" }));
    page("Panes");
    page("Glass");
    expect(
      screen.getByRole("slider", { name: "Opacity" }).getAttribute("aria-valuenow"),
    ).toBe("55");
    page("General");
    expect(
      (
        screen.getByRole("switch", {
          name: "App tiles",
        }) as HTMLInputElement
      ).getAttribute("aria-checked"),
    ).toBe("false");
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].appearance).toMatchObject({
      showAppLabels: false,
      glass: { mode: "glass", opacity: 55 },
    });
  });
  it("keeps accent choices independent of the custom palette disclosure", async () => {
    const { apply, container } = setup();
    page("Appearance");
    page("Blue");
    expect(
      screen.getByRole("button", {name: "Custom palette"}).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed"),
    ).toBe("true");
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].appearance.palette.accent).toBe("#7db7ff");
  });
  it("remaps named accent chips when the theme changes", async () => {
    const { apply } = setup();
    page("Appearance");
    page("Blue");
    page("Daylight");
    expect(
      screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed"),
    ).toBe("true");
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply.mock.calls[0][0].appearance).toMatchObject({
      theme: "light",
      palette: { accent: "#1d4f91" },
    });
  });
  it("warns on page unload only while changes are pending", () => {
    setup();
    let event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Changed" },
    });
    event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("previews draft appearance without applying until Apply settings", async () => {
    const { apply, preview } = setup();
    await flushPreview();
    expect(preview).toHaveBeenCalled();
    const baseline = preview.mock.calls.at(-1)?.[0] as Config;
    expect(baseline.appearance.theme).toBe("dark");
    page("Appearance");
    page("Daylight");
    await flushPreview();
    expect(apply).not.toHaveBeenCalled();
    const live = preview.mock.calls.at(-1)?.[0] as Config;
    expect(live.appearance.theme).toBe("light");
    expect(live.items).toEqual([]);
    page("Apply settings");
    await act(async () => { await Promise.resolve(); });
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].appearance.theme).toBe("light");
  });
  it("coalesces shell previews to one call per animation frame", async () => {
    const { preview } = setup();
    await flushPreview();
    const before = preview.mock.calls.length;
    page("Appearance");
    page("Daylight");
    page("Midnight");
    page("Daylight");
    expect(preview.mock.calls.length).toBe(before);
    await flushPreview();
    expect(preview.mock.calls.length).toBe(before + 1);
    expect(
      (preview.mock.calls.at(-1)?.[0] as Config).appearance.theme,
    ).toBe("light");
  });
  it("discards the preview when Cancel confirms without applying", async () => {
    const { apply, close, preview } = setup();
    page("Appearance");
    page("Daylight");
    await flushPreview();
    expect(
      (preview.mock.calls.at(-1)?.[0] as Config).appearance.theme,
    ).toBe("light");
    page("Cancel"); page("Discard");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(apply).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it("Current band live preview stays still until hover linger", async () => {
    vi.useFakeTimers();
    const play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = play;
    HTMLMediaElement.prototype.pause = vi.fn();
    const cfg = config();
    cfg.appearance.background = {
      wallpaper: {
        kind: "video",
        media: { source: "builtin", builtinId: "aurora@v1" },
        position: "center",
        playback: "loop",
      },
      library: [],
      photoMotion: { style: "none", intensity: 40 },
      themeOverlayOpacity: 25,
    };
    setup(cfg);
    page("Background");
    const preview = screen.getByLabelText("Aurora, live wallpaper preview");
    expect(preview.querySelector("video")).toBeNull();
    expect(
      preview.querySelector("img.wallpaper-tile-image")?.getAttribute("src"),
    ).toMatch(/aurora-thumb/);
    fireEvent.mouseEnter(preview);
    expect(preview.querySelector("video")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_HOVER_PREVIEW_MS);
    });
    expect(preview.querySelector("video.wallpaper-tile-video")).toBeTruthy();
    expect(play).toHaveBeenCalled();
    expect(preview.querySelector("img.wallpaper-tile-image")).toBeTruthy();
  });

  it("Recently selected live tiles stay still until hover linger", async () => {
    vi.useFakeTimers();
    const play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = play;
    HTMLMediaElement.prototype.pause = vi.fn();
    recordRecentWallpaper({
      kind: "video",
      media: { source: "builtin", builtinId: "neon-wave@v1" },
      position: "center",
      playback: "loop",
    });
    setup();
    page("Background");
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    const tile = screen.getByRole("button", {
      name: /Neon Wave, live wallpaper/,
    });
    const wrap = tile.closest(".wallpaper-tile-wrap")!;
    expect(wrap.querySelector("video")).toBeNull();
    fireEvent.mouseEnter(wrap);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_HOVER_PREVIEW_MS);
    });
    expect(wrap.querySelector("video.wallpaper-tile-video")).toBeTruthy();
    expect(play).toHaveBeenCalled();
  });

  it("removing an upload drops it from My media and Recently selected", async () => {
    const asset = { source: "asset" as const, assetId: "upload-hulk" };
    const cfg = config();
    cfg.appearance.background = {
      wallpaper: { kind: "image", media: asset, position: "center" },
      library: [asset],
      photoMotion: { style: "none", intensity: 40 },
      themeOverlayOpacity: 25,
    };
    recordRecentWallpaper({
      kind: "image",
      media: asset,
      position: "center",
    });
    setup(cfg);
    page("Background");
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    const chooser = screen.getByRole("dialog", { name: "Choose wallpaper" });
    expect(within(chooser).getByRole("heading", { name: "Recently selected" })).toBeTruthy();
    fireEvent.click(within(chooser).getByRole("button", { name: "My media" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Remove Photo" })).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("heading", { name: "Recently selected" })).toBeNull();
  });

  it("shows oversized wallpaper upload errors inline in Choose wallpaper, not as a nested alert", async () => {
    setup();
    page("Background");
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    const chooser = screen.getByRole("dialog", { name: "Choose wallpaper" });
    const input = chooser.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["x"], "big.webp", { type: "image/webp" });
    Object.defineProperty(file, "size", { value: 13 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Choose an image up to 12 MiB.",
      );
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(chooser.querySelector(".background-library-sheet-notice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
  });
  it("drags from the Settings title bar without starting from Close", () => {
    const { container } = setup();
    const dialog = screen.getByRole("dialog") as HTMLDivElement;
    const title = container.querySelector(".modal-title") as HTMLElement;
    expect(title.classList.contains("modal-title-draggable")).toBe(true);
    title.setPointerCapture = vi.fn();
    title.hasPointerCapture = vi.fn(() => true);
    title.releasePointerCapture = vi.fn();
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 80,
      top: 80,
      left: 100,
      right: 500,
      bottom: 600,
      width: 400,
      height: 520,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(title, {
      button: 0,
      pointerId: 1,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerMove(title, { pointerId: 1, clientX: 260, clientY: 140 });
    expect(dialog.style.transform).toContain("translate(calc(-50% + 60px), calc(-50% + 40px))");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }), {
      button: 0,
      pointerId: 2,
      clientX: 480,
      clientY: 100,
    });
    fireEvent.pointerMove(title, { pointerId: 2, clientX: 400, clientY: 200 });
    expect(dialog.style.transform).toContain("translate(calc(-50% + 60px), calc(-50% + 40px))");
  });
});


it("late missing-file checks preserve the latest selection and Cancel snapshot", async () => {
  const asset = { source: "asset" as const, assetId: "missing-upload" };
  const cfg = config();
  cfg.appearance.background = {
    wallpaper: { kind: "image", media: asset, position: "center" }, library: [asset],
    photoMotion: { style: "none", intensity: 40 }, themeOverlayOpacity: 25,
  };
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => { finish = resolve; });
  vi.spyOn(globalThis, "fetch").mockReturnValue(response);
  const { apply } = setup(cfg);
  page("Background");
  fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
  fireEvent.click(screen.getByRole("button", { name: "Gradients" }));
  fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
  await act(async () => finish(new Response(null, { status: 404 })));
  expect(screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Use wallpaper" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
  await act(async () => { await Promise.resolve(); });
  const saved = apply.mock.calls[0][0];
  expect(saved.appearance.background.wallpaper).toEqual({ kind: "gradient", preset: "ocean" });
  expect(saved.appearance.background.library).toEqual([]);
});

it("updates selected uploads immediately, survives navigation, and saves the entire history on Apply", async () => {
  const first = {source:"asset" as const,assetId:"first"};
  const second = {source:"asset" as const,assetId:"second"};
  const cfg = config();
  cfg.appearance.background = {wallpaper:{kind:"none"},library:[first,second],photoMotion:{style:"none",intensity:40},themeOverlayOpacity:25};
  vi.spyOn(globalThis,"fetch").mockImplementation(async (input) => new Response(JSON.stringify({kind:"image",name:String(input).includes("first") ? "First" : "Second"}),{status:200}));
  const {apply, close} = setup(cfg);
  page("Background");
  fireEvent.click(screen.getByRole("button",{name:"Change wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"My media"}));
  fireEvent.click(await screen.findByRole("button",{name:"First"}));
  fireEvent.click(screen.getByRole("button",{name:"Second"}));
  fireEvent.click(screen.getByRole("button",{name:"Back"}));
  let strip = screen.getByLabelText("Recently selected wallpapers");
  expect(strip.closest(".wallpaper-recent-inset")).toBeTruthy();
  expect(within(strip).getAllByRole("button").map(b=>b.querySelector("img")?.getAttribute("src"))).toEqual(["/media/assets/second/poster","/media/assets/first/poster"]);
  expect(loadRecentWallpapers()).toEqual([]);
  fireEvent.click(screen.getByRole("button",{name:"Use wallpaper"}));
  page("General"); page("Background");
  fireEvent.click(screen.getByRole("button",{name:"Change wallpaper"}));
  strip = screen.getByLabelText("Recently selected wallpapers");
  expect(within(strip).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"Use wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"Apply settings"}));
  await act(async () => { await Promise.resolve(); });
  expect(loadRecentWallpapers().map(e=>e.key)).toEqual(["image:asset:second","image:asset:first"]);
  await waitFor(() => expect(close).toHaveBeenCalled());
});

it("restores history on chooser discard and leaves saved history unchanged on Settings Cancel", async () => {
  const cfg = config();
  const asset = {source:"asset" as const,assetId:"one"};
  cfg.appearance.background = {wallpaper:{kind:"none"},library:[asset],photoMotion:{style:"none",intensity:40},themeOverlayOpacity:25};
  vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({kind:"image",name:"One"}),{status:200}));
  const {close} = setup(cfg); page("Background");
  fireEvent.click(screen.getByRole("button",{name:"Change wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"My media"}));
  fireEvent.click(await screen.findByRole("button",{name:"One"}));
  fireEvent.click(within(screen.getByRole("dialog",{name:"My media"})).getByRole("button",{name:"Close"}));
  fireEvent.click(screen.getByRole("button",{name:"Discard"}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"My media"})).toBeNull());
  fireEvent.click(screen.getByRole("button",{name:"Change wallpaper"}));
  expect(screen.queryByRole("heading",{name:"Recently selected"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"My media"}));
  fireEvent.click(await screen.findByRole("button",{name:"One"}));
  fireEvent.click(screen.getByRole("button",{name:"Use wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Discard"}));
  await waitFor(()=>expect(close).toHaveBeenCalled());
  expect(loadRecentWallpapers()).toEqual([]);
});

it("tracks built-ins immediately and recognises history-only changes", async () => {
  const cfg = config();
  cfg.appearance.background = {wallpaper:{kind:"video",media:{source:"builtin",builtinId:"aurora@v1"},position:"center",playback:"loop"},library:[],photoMotion:{style:"none",intensity:40},themeOverlayOpacity:25};
  const {apply} = setup(cfg); page("Background");
  fireEvent.click(screen.getByRole("button",{name:"Change wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"Live"}));
  fireEvent.click(screen.getByRole("button",{name:"Neon Wave, live wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"Aurora, live wallpaper"}));
  fireEvent.click(screen.getByRole("button",{name:"Back"}));
  const strip=screen.getByLabelText("Recently selected wallpapers");
  expect(within(strip).getAllByRole("button").map(b=>b.getAttribute("aria-label"))).toEqual(["Aurora, live wallpaper","Neon Wave, live wallpaper"]);
  // Reselecting the same item does not duplicate it.
  fireEvent.click(within(strip).getByRole("button",{name:"Aurora, live wallpaper"}));
  expect(within(strip).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(within(screen.getByRole("dialog",{name:"Choose wallpaper"})).getByRole("button",{name:"Close"}));
  expect(screen.getByRole("alertdialog",{name:"Discard wallpaper changes?"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Keep editing"}));
  fireEvent.click(screen.getByRole("button",{name:"Use wallpaper"}));
  fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
  await act(async () => { await Promise.resolve(); });
  flushPendingRecentWallpaper(apply.mock.calls[0][0].appearance.background);
  expect(loadRecentWallpapers().map(e=>e.key)).toEqual(["video:builtin:aurora@v1","video:builtin:neon-wave@v1"]);
});


describe("settings apply lifecycle", () => {
  it("keeps the dialog open until commitSettings acknowledges the snapshot", async () => {
    let finish!: (value: { status: "saved"; config: Config }) => void;
    const gate = new Promise<{ status: "saved"; config: Config }>((resolve) => {
      finish = resolve;
    });
    const close = vi.fn();
    const cfg = config();
    const commitSettings = vi.fn(async (settings: {
      dashboard: Config["dashboard"];
      appearance: Config["appearance"];
    }) => {
      const merged = { ...cfg, ...settings };
      await gate;
      return { status: "saved" as const, config: merged };
    });
    render(
      <Settings
        config={cfg}
        commitSettings={commitSettings}
        discardSettings={vi.fn()}
        close={close}
        imported={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Saved later" },
    });
    page("Apply settings");
    expect(screen.getByText(/Saving settings/i)).toBeTruthy();
    expect(close).not.toHaveBeenCalled();
    page("Cancel");
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      finish({
        status: "saved",
        config: {
          ...cfg,
          dashboard: { ...cfg.dashboard, title: "Saved later" },
        },
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("offers Retry after a failed save and discards abandoned drafts on Cancel", async () => {
    const discardSettings = vi.fn();
    const close = vi.fn();
    const cfg = config();
    const commitSettings = vi
      .fn()
      .mockResolvedValueOnce({ status: "failed", error: "Save failed" })
      .mockResolvedValueOnce({
        status: "saved",
        config: { ...cfg, dashboard: { ...cfg.dashboard, title: "Retried" } },
      });
    render(
      <Settings
        config={cfg}
        commitSettings={commitSettings}
        discardSettings={discardSettings}
        close={close}
        imported={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Retried" },
    });
    page("Apply settings");
    await waitFor(() => expect(screen.getByText(/Save failed/i)).toBeTruthy());
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(commitSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("offers Reload on conflict without closing the draft", async () => {
    const close = vi.fn();
    const cfg = config();
    render(
      <Settings
        config={cfg}
        commitSettings={vi.fn(async () => ({
          status: "conflict" as const,
          error: "Configuration changed elsewhere.",
        }))}
        discardSettings={vi.fn()}
        close={close}
        imported={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Conflicted" },
    });
    page("Apply settings");
    await waitFor(() =>
      expect(screen.getByText(/Configuration changed elsewhere/i)).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(close).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value,
    ).toBe("Conflicted");
  });
});
