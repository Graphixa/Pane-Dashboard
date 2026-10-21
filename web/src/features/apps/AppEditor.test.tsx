// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppEditor } from "./AppEditor";
import { resolvePlacement, type Config } from "../../model";
import { populatedConfig, testPane } from "../../testConfig";

const baseConfig = () => {
  const c = populatedConfig();
  c.spaces[0].items = [testPane({ apps: [{ id: "plc-plex", appId: "plex", col: 0, row: 0 }] })];
  return c;
};

const editApp = (config = baseConfig()) =>
  resolvePlacement(config, config.spaces[0].items[0].apps[0]);

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
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function searchAndSelect(displayName: string, query = displayName) {
  fireEvent.change(screen.getByLabelText("Search apps"), {
    target: { value: query },
  });
  const tile = await screen.findByRole("button", { name: displayName });
  fireEvent.click(tile);
}

async function openCustomIcon() {
  fireEvent.click(screen.getByRole("button", { name: "Custom icon" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText("Icon reference or custom URL"),
    ).toBeTruthy(),
  );
}

describe("AppEditor catalogue name autofill", () => {
  it("fills a blank name from the selected tile and leaves other fields alone", async () => {
    const apply = vi.fn();
    const close = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={close}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
    await searchAndSelect("Adguard Home", "adguard");
    expect(screen.getByLabelText("Name")).toHaveProperty(
      "value",
      "Adguard Home",
    );
    await openCustomIcon();
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:adguard-home",
    );
    expect(screen.getByLabelText("Address")).toHaveProperty("value", "");
    expect(screen.getByRole("dialog", { name: "Add app" })).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("preserves an edited name when selecting another tile", async () => {
    const apply = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={vi.fn()}
      />,
    );

    await searchAndSelect("Adguard Home", "adguard");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "My DNS" },
    });
    await searchAndSelect("Plex", "plex");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "My DNS");
    await openCustomIcon();
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:plex",
    );
  });

  it("does not overwrite a typed name, then autofills again after clear", async () => {
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
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
    await searchAndSelect("Plex", "plex");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Custom");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    await searchAndSelect("Home Assistant", "home-assistant");
    expect(screen.getByLabelText("Name")).toHaveProperty(
      "value",
      "Home Assistant",
    );
  });

  it("supports keyboard activation of a catalogue tile", async () => {
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search apps"), {
      target: { value: "pihole" },
    });
    const tile = await screen.findByRole("button", { name: "Pi Hole" });
    tile.focus();
    fireEvent.keyDown(tile, { key: "Enter" });
    fireEvent.click(tile);
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Pi Hole");
    await openCustomIcon();
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:pi-hole",
    );
  });

  it("does not infer a name from custom icon reference typing", async () => {
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );

    await openCustomIcon();
    fireEvent.change(screen.getByLabelText("Icon reference or custom URL"), {
      target: { value: "dashboard-icons:sonarr" },
    });
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
  });

  it("preserves a loaded Edit app name when changing icon tile", async () => {
    const apply = vi.fn();
    const close = vi.fn();
    const config = baseConfig();
    const app = editApp(config);
    render(
      <AppEditor
        config={config}
        spaceId="home"
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
    await searchAndSelect("Sonarr", "sonarr");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Plex");
    await openCustomIcon();
    expect(screen.getByLabelText("Icon reference or custom URL")).toHaveProperty(
      "value",
      "dashboard-icons:sonarr",
    );
    expect(screen.getByLabelText("Address")).toHaveProperty(
      "value",
      "https://plex.example.com",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Discard changes?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(apply).not.toHaveBeenCalled();
  });

  it("saves the autofilled name and icon through the ordinary path", async () => {
    const apply = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={apply}
        close={vi.fn()}
      />,
    );

    await searchAndSelect("Adguard Home", "adguard");
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "https://dns.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add app" }));

    expect(apply).toHaveBeenCalledTimes(1);
    const saved = apply.mock.calls[0][0] as Config;
    const def = saved.apps.find((a) => a.name === "Adguard Home");
    expect(def).toMatchObject({
      name: "Adguard Home",
      icon: "dashboard-icons:adguard-home",
      url: "https://dns.example.com",
    });
    const placement = saved.spaces[0].items[0].apps.find(
      (a) => a.appId === def?.id,
    );
    expect(placement).toMatchObject({ col: 1, row: 0 });
  });
});

describe("AppEditor workflow", () => {
  it("keeps placement and custom icon collapsed and preserves the clicked slot", async () => {
    const apply = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={2}
        row={0}
        apply={apply}
        close={vi.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Icon reference or custom URL"),
    ).toBeNull();
    expect(screen.queryByLabelText("Column (1-based)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Placement" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Column (1-based)")).toBeTruthy(),
    );
    expect(screen.getByText(/Media · column 3, row 1/)).toBeTruthy();
    expect(screen.getByLabelText("Column (1-based)")).toHaveProperty(
      "value",
      "3",
    );

    await searchAndSelect("Plex", "plex");
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "https://plex.local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add app" }));
    const saved = apply.mock.calls[0][0] as Config;
    const def = saved.apps.find((a) => a.url === "https://plex.local");
    expect(def).toMatchObject({ icon: "dashboard-icons:plex" });
    const placement = saved.spaces[0].items[0].apps.find(
      (a) => a.appId === def?.id,
    );
    expect(placement).toMatchObject({ col: 2, row: 0 });
  });

  it("does not prompt discard when only searching or scrolling", async () => {
    const close = vi.fn();
    render(
      <AppEditor
        config={baseConfig()}
        spaceId="home"
        paneId="media"
        col={1}
        row={0}
        apply={vi.fn()}
        close={close}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search apps"), {
      target: { value: "plex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("prompts discard when the draft changed, and Save changes updates an existing app", async () => {
    const apply = vi.fn();
    const close = vi.fn();
    const config = baseConfig();
    const app = editApp(config);
    render(
      <AppEditor
        config={config}
        spaceId="home"
        paneId="media"
        app={app}
        col={app.col}
        row={app.row}
        apply={apply}
        close={close}
      />,
    );

    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "https://plex.changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(close).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0].apps[0].url).toBe("https://plex.changed");
  });

  it("keeps remove separate from the primary save action", () => {
    const config = baseConfig();
    const app = editApp(config);
    render(
      <AppEditor
        config={config}
        spaceId="home"
        paneId="media"
        app={app}
        col={app.col}
        row={app.row}
        apply={vi.fn()}
        close={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove from pane" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save app" })).toBeNull();
  });
});
