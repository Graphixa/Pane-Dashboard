// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  return { ...result, apply, close, imported, preview };
};
const page = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
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
    fireEvent.change(screen.getByLabelText("Font"), {
      target: { value: "oxanium" },
    });
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
  it("protects changed drafts from Escape, Cancel and Close", () => {
    const { close } = setup();
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
      target: { value: "Changed" },
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    page("Cancel");
    page("Close");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(close).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    page("Cancel");
    expect(close).toHaveBeenCalledOnce();
  });
  it("validates hidden sections before applying", () => {
    const { apply } = setup();
    page("Appearance");
    fireEvent.click(
      screen.getByText("Custom palette", { selector: "summary" }),
    );
    fireEvent.change(screen.getByLabelText("Text", { exact: true }), {
      target: { value: "#111720" },
    });
    page("General");
    page("Apply settings");
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/contrast/i);
  });
  it("offers Appearance and Background pages with ordered headings and no miniature previews", () => {
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
    expect(
      screen.getByRole("heading", { level: 4, name: "Accent" }),
    ).toBeTruthy();
    page("Background");
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent),
    ).toEqual(["Static", "Animated"]);
    expect(
      screen.queryByRole("switch", { name: "Show app labels" }),
    ).toBeNull();
  });
  it("keeps labels in Panes and retains glass tuning across finish and page changes", () => {
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
    fireEvent.change(screen.getByRole("slider", { name: "Opacity" }), {
      target: { value: "55" },
    });
    page("Solid");
    page("General");
    page("Panes");
    page("Glass");
    expect(
      (screen.getByRole("slider", { name: "Opacity" }) as HTMLInputElement)
        .value,
    ).toBe("55");
    expect(
      (
        screen.getByRole("switch", {
          name: "Show app labels",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
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
      container.querySelector(".settings-disclosure")?.hasAttribute("open"),
    ).toBe(false);
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
  it("previews draft appearance without applying until Apply settings", () => {
    const { apply, preview } = setup();
    expect(preview).toHaveBeenCalled();
    const baseline = preview.mock.calls.at(-1)?.[0] as Config;
    expect(baseline.appearance.theme).toBe("dark");
    page("Appearance");
    page("Daylight");
    expect(apply).not.toHaveBeenCalled();
    const live = preview.mock.calls.at(-1)?.[0] as Config;
    expect(live.appearance.theme).toBe("light");
    expect(live.items).toEqual([]);
    page("Apply settings");
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].appearance.theme).toBe("light");
  });
  it("discards the preview when Cancel confirms without applying", () => {
    const { apply, close, preview } = setup();
    page("Appearance");
    page("Daylight");
    expect(
      (preview.mock.calls.at(-1)?.[0] as Config).appearance.theme,
    ).toBe("light");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    page("Cancel");
    expect(apply).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});
