// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Settings from "./Settings";
import { Config } from "./model";
const config = (): Config => ({
  version: 2,
  dashboard: { title: "Akira", widthMode: "fixed", width: 960 },
  appearance: { theme: "dark", showAppLabels: true, showButtonLabels: true },
  items: [],
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
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const setup = () => {
  const apply = vi.fn(),
    close = vi.fn(),
    imported = vi.fn(),
    preview = vi.fn();
  const result = render(
    <Settings
      config={config()}
      apply={apply}
      close={close}
      imported={imported}
      onPreview={preview}
      readOnly={false}
    />,
  );
  return { ...result, container: document.body, apply, close, imported, preview };
};
const page = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
/** Settings coalesces onPreview to animation frames. */
const flushPreview = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
describe("settings navigation and draft safety", () => {
  it("keeps a draft across sections and blocks import and backup until it is applied", () => {
    const { apply } = setup();
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
      target: { value: "My server" },
    });
    page("Appearance");
    fireEvent.change(screen.getByLabelText("Pane title size (px)"), {
      target: { value: "20" },
    });
    fireEvent.keyDown(screen.getByRole("combobox", {name: "Font"}), {key: "ArrowDown"});
    fireEvent.click(screen.getByRole("option", {name: "Oxanium"}));
    page("Import & backup");
    expect(screen.queryByText("Confirm import")).toBeNull();
    expect(screen.getByText(/Apply your settings first/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Download full backup",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    page("General");
    expect(
      (screen.getByLabelText("Dashboard name") as HTMLInputElement).value,
    ).toBe("My server");
    page("About");
    page("Apply settings");
    expect(apply.mock.calls[0][0].dashboard.title).toBe("My server");
    expect(apply.mock.calls[0][0].appearance.paneTitleSize).toBe(20);
    expect(apply.mock.calls[0][0].appearance.fontFamily).toBe("oxanium");
  });
  it("protects changed drafts from Escape, Cancel and Close", async () => {
    const { close } = setup();
    fireEvent.change(screen.getByLabelText("Dashboard name"), {target: {value: "Changed"}});
    for (const action of ["Cancel", "Close", "Escape"]) {
      if(action === "Escape") fireEvent.keyDown(document, {key: "Escape"}); else page(action);
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      page("Keep changes");
      expect(close).not.toHaveBeenCalled();
    }
    page("Cancel"); page("Discard");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("validates hidden sections before applying", () => {
    const { apply } = setup();
    page("Appearance");
    fireEvent.click(
      screen.getByRole("button", {name: "Custom palette"}),
    );
    fireEvent.change(screen.getByLabelText("Text", { exact: true }), {
      target: { value: "#111720" },
    });
    page("General");
    page("Apply settings");
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/contrast/i);
  });
  it("offers Appearance and Background pages with ordered headings and no miniature previews", { timeout: 15000 }, () => {
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
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("button", { name: "Change wallpaper" })).toBeTruthy();
    expect(screen.getByText("Currently set")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Show all Gradients/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(screen.getByRole("dialog", { name: "Choose wallpaper" })).toBeTruthy();
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Choose wallpaper" }).classList.contains("ui-dialog-bottom")).toBe(true);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Colours" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My images" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gradients" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dynamic" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Scroll .+ left/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Mint" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Custom colour" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    expect(
      screen.getByRole("button", { name: "Mint" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Choose wallpaper" })).toBeNull();
    expect(screen.getByText("None")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(
      screen.getByRole("button", { name: "Mint" }).getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("dialog", { name: "Choose wallpaper" })).toBeNull();
    expect(screen.getByText("Mint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(screen.getByRole("button", { name: "Show all My images" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show all Gradients" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show all Dynamic" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all Gradients" }));
    expect(screen.getByRole("dialog", { name: "Gradients" })).toBeTruthy();
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Scroll Gradients/ })).toBeNull();
    expect(document.querySelector(".background-library-grid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(
      screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Forest" }));
    expect(
      screen.getByRole("button", { name: "Forest" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("dialog", { name: "Choose wallpaper" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Gradients" })).toBeNull();
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeNull();
    expect(screen.getByText("Forest")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Motion effects" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Wallpaper overlay" })).toBeTruthy();
    const overlayCustomize = screen.getByRole("button", {
      name: "Customize overlay",
    });
    expect(overlayCustomize.hasAttribute("disabled")).toBe(false);
    fireEvent.click(overlayCustomize);
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Overlay settings" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all Gradients" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(
      screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Gradients" })).toBeNull();
    expect(screen.getByText("Forest")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all Gradients" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Choose wallpaper" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all Gradients" }));
    expect(
      screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("dialog", { name: "Gradients" })).toBeNull();
    expect(screen.getByText("Ocean")).toBeTruthy();
    expect(
      screen.queryByRole("switch", { name: "Show app labels" }),
    ).toBeNull();
  });
  it("keeps labels in Panes and retains glass tuning across finish and page changes", { timeout: 10000 }, () => {
    const { apply } = setup();
    page("Panes");
    expect(screen.queryByRole("heading", { name: "Fine tuning" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Show app labels" }));
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
    page("Panes");
    page("Glass");
    expect(
      screen.getByRole("slider", { name: "Opacity" }).getAttribute("aria-valuenow"),
    ).toBe("55");
    expect(
      (
        screen.getByRole("switch", {
          name: "Show app labels",
        }) as HTMLInputElement
      ).getAttribute("aria-checked"),
    ).toBe("false");
    page("Apply settings");
    expect(apply.mock.calls[0][0].appearance).toMatchObject({
      showAppLabels: false,
      glass: { mode: "glass", opacity: 55 },
    });
  });
  it("keeps accent choices independent of the custom palette disclosure", () => {
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
    expect(apply.mock.calls[0][0].appearance.palette.accent).toBe("#7db7ff");
  });
  it("remaps named accent chips when the theme changes", () => {
    const { apply } = setup();
    page("Appearance");
    page("Blue");
    page("Daylight");
    expect(
      screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed"),
    ).toBe("true");
    page("Apply settings");
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
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
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

