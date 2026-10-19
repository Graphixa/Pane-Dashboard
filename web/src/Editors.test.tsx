// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppEditor } from "./Editors";
import { Config } from "./model";

const baseConfig = (): Config => ({
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
          icon: "dashboard-icons:plex",
          col: 0,
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
});

afterEach(() => {
  cleanup();
});

function searchAndSelect(displayName: string, query = displayName) {
  fireEvent.change(screen.getByLabelText("Search icons"), {
    target: { value: query },
  });
  fireEvent.click(screen.getByRole("button", { name: displayName }));
}

describe("AppEditor catalogue name autofill", () => {
  it("fills a blank name from the selected tile and leaves other fields alone", () => {
    const apply = vi.fn();
    const close = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={close}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
    searchAndSelect("AdGuard Home", "adguard");
    expect(screen.getByLabelText("Name")).toHaveProperty(
      "value",
      "AdGuard Home",
    );
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:adguard-home",
    );
    expect(screen.getByLabelText("Address")).toHaveProperty("value", "");
    expect(screen.getByRole("dialog", { name: "Add app" })).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("preserves an edited name when selecting another tile", () => {
    const apply = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={vi.fn()}
      />,
    );

    searchAndSelect("AdGuard Home", "adguard");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "My DNS" },
    });
    searchAndSelect("Plex", "plex");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "My DNS");
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:plex",
    );
  });

  it("does not overwrite a typed name, then autofills again after clear", () => {
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Custom" },
    });
    searchAndSelect("Plex", "plex");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Custom");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    searchAndSelect("Home Assistant", "home-assistant");
    expect(screen.getByLabelText("Name")).toHaveProperty(
      "value",
      "Home Assistant",
    );
  });

  it("supports keyboard activation of a catalogue tile", () => {
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search icons"), {
      target: { value: "pihole" },
    });
    const tile = screen.getByRole("button", { name: "Pi-hole" });
    tile.focus();
    fireEvent.keyDown(tile, { key: "Enter" });
    fireEvent.click(tile);
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Pi-hole");
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:pihole",
    );
  });

  it("does not infer a name from custom icon reference typing", () => {
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Icon reference or custom URL"), {
      target: { value: "dashboard-icons:sonarr" },
    });
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
  });

  it("preserves a loaded Edit app name when changing icon tile", () => {
    const apply = vi.fn();
    const close = vi.fn();
    const config = baseConfig();
    const app = config.items[0].apps[0];
    render(
      <AppEditor
        config={config}
        paneId="media"
        app={app}
        col={app.col}
        row={app.row}
        apply={apply}
        close={close}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Edit app" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Plex");
    searchAndSelect("Sonarr", "sonarr");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Plex");
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:sonarr",
    );
    expect(screen.getByLabelText("Address")).toHaveProperty(
      "value",
      "https://plex.example.com",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("saves the autofilled name and icon through the ordinary path", () => {
    const apply = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={vi.fn()}
      />,
    );

    searchAndSelect("AdGuard Home", "adguard");
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "https://dns.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save app" }));

    expect(apply).toHaveBeenCalledTimes(1);
    const saved = apply.mock.calls[0][0] as Config;
    const added = saved.items[0].apps.find((a) => a.name === "AdGuard Home");
    expect(added).toMatchObject({
      name: "AdGuard Home",
      icon: "dashboard-icons:adguard-home",
      url: "https://dns.example.com",
      col: 1,
      row: 0,
    });
  });
});
