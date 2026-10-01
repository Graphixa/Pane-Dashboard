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
    imported = vi.fn();
  const result = render(
    <Settings
      config={config()}
      apply={apply}
      close={close}
      imported={imported}
      readOnly={false}
    />,
  );
  return { ...result, apply, close, imported };
};
const page = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const tab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));
describe("settings navigation and draft safety", () => {
  it("keeps a draft across sections and blocks import and backup until it is applied", () => {
    const { apply } = setup();
    fireEvent.change(screen.getByLabelText("Dashboard name"), {
      target: { value: "My server" },
    });
    page("Appearance");
    tab("Typography");
    fireEvent.change(screen.getByLabelText("Pane title size (px)"), {
      target: { value: "20" },
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
    tab("Colours");
    fireEvent.click(screen.getByRole("switch", { name: "Custom colours" }));
    fireEvent.change(screen.getByLabelText("Text", { exact: true }), {
      target: { value: "#111720" },
    });
    page("General");
    page("Apply settings");
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/contrast/i);
  });
  it("supports keyboard appearance tabs without losing the selected sub-section", () => {
    setup();
    page("Appearance");
    const theme = screen.getByRole("tab", { name: "Theme" });
    theme.focus();
    fireEvent.keyDown(theme, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Typography" }),
    );
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      "settings-tab-typography",
    );
    page("Panes");
    page("Appearance");
    expect(
      screen
        .getByRole("tab", { name: "Typography" })
        .getAttribute("aria-selected"),
    ).toBe("true");
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
});
