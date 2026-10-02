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
import { Config, sanitiseExport, validate } from "./model";
import {
  appearanceStyle,
  defaultBackground,
  imageReference,
  palettes,
  validateVisuals,
} from "./appearance";
import Settings from "./Settings";
import Background from "./Background";
import { HeaderBrand } from "./BrandLogo";
import ImageField, { prepareUpload } from "./ImageField";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1kAAAAASUVORK5CYII=";
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
  vi.unstubAllGlobals();
});
describe("global appearance", () => {
  it("validates safe portable images and rejects scripts, CSS injection and low contrast", () => {
    expect(imageReference(png)).toBe(true);
    for (const url of [
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,aGVsbG8=",
      "https://user:pass@example.com/logo.png",
      "javascript:alert(1)",
    ])
      expect(imageReference(url)).toBe(false);
    expect(() =>
      validateVisuals({
        theme: "dark",
        palette: { ...palettes.dark, text: "#111720" },
      }),
    ).toThrow(/contrast/);
    expect(() =>
      validateVisuals({
        theme: "dark",
        palette: { ...palettes.dark, accent: "red; color:blue" },
      }),
    ).toThrow(/hex/);
    const c = config();
    c.dashboard.logo = png;
    c.appearance.background = {
      ...defaultBackground,
      kind: "image",
      image: png,
    };
    c.appearance.glass = { mode: "glass", opacity: 60, blur: 16 };
    validate(c);
    expect(sanitiseExport(c).appearance.background?.image).toBe(png);
    expect(() =>
      validate({
        ...c,
        items: [
          {
            id: "p",
            type: "pane",
            title: "",
            layout: { x: 0, y: 0, w: 4, h: 1 },
            apps: [],
            glass: { mode: "glass" },
          },
        ],
      }),
    ).toThrow(/Unknown/);
  });
  it("uses global finish variables without setting content opacity", () => {
    const style = appearanceStyle({
      theme: "dark",
      glass: { mode: "glass", opacity: 40, blur: 20 },
    }) as Record<string, string>;
    expect(style["--surface-fill"]).toBe("rgba(26,34,46,0.4)");
    expect(style["--surface-filter"]).toContain("20px");
    expect(style.opacity).toBeUndefined();
  });
  it("keeps background and glass choices in a draft, then applies one configuration", () => {
    const apply = vi.fn(),
      c = config();
    render(
      <Settings
        config={c}
        apply={apply}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.click(screen.getByRole("button", { name: "Panes" }));
    fireEvent.click(screen.getByRole("button", { name: "Glass" }));
    fireEvent.change(screen.getByRole("slider", { name: "Pane opacity" }), {
      target: { value: "55" },
    });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply).toHaveBeenCalledOnce();
    const saved = apply.mock.calls[0][0];
    expect(saved.appearance.background).toMatchObject({
      kind: "gradient",
      preset: "ocean",
    });
    expect(saved.appearance.glass.opacity).toBe(55);
    expect(saved.items).toEqual(c.items);
  });
  it("does not persist a cancelled settings draft", () => {
    const apply = vi.fn(),
      close = vi.fn();
    render(
      <Settings
        config={config()}
        apply={apply}
        imported={vi.fn()}
        close={close}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Full logo" }));
    fireEvent.change(screen.getByLabelText("Logo image URL"), {
      target: { value: "https://example.com/wordmark.png" },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(apply).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it("renders wide logos without duplicate visible titles and falls back on failure", () => {
    const r = render(
      <HeaderBrand
        dashboard={{ ...config().dashboard, branding: "logo", logo: png }}
      />,
    );
    expect(screen.getByRole("img", { name: "Akira" })).toBeTruthy();
    expect(r.container.querySelector(".brand-name")).toBeNull();
    fireEvent.error(screen.getByRole("img", { name: "Akira" }));
    expect(screen.getByText("Akira")).toBeTruthy();
  });
  it("pauses decorative animation when motion is disabled and falls back from broken images", () => {
    const r = render(
      <Background
        settings={{ ...defaultBackground, kind: "waves", motion: false }}
      />,
    );
    expect(r.container.querySelector(".motion-paused")).not.toBeNull();
    r.rerender(
      <Background
        settings={{
          ...defaultBackground,
          kind: "image",
          image: "https://example.com/broken.png",
        }}
      />,
    );
    fireEvent.error(r.container.querySelector("img")!);
    expect(r.container.querySelector("img")).toBeNull();
  });
  it("keeps appearance controls disabled in read-only presentation", () => {
    render(
      <Settings
        config={config()}
        apply={vi.fn()}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Apply settings" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByLabelText("Dashboard name").closest("fieldset")?.disabled,
    ).toBe(true);
  });
});
describe("image preparation", () => {
  it("rejects oversized and unsupported input before decoding", async () => {
    await expect(
      prepareUpload(
        new File(["svg"], "logo.svg", { type: "image/svg+xml" }),
        "icon",
      ),
    ).rejects.toThrow(/PNG/);
    const file = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 9 * 1024 * 1024 });
    await expect(prepareUpload(file, "background")).rejects.toThrow(/8 MiB/);
  });
  it("opens the OS picker and prepares selected files without saving configuration", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
      cb(new Blob(["png"], { type: "image/png" })),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ image: png })));
    vi.stubGlobal("fetch", fetcher);
    const change = vi.fn(),
      busy = vi.fn();
    render(
      <ImageField
        label="Logo image"
        value=""
        kind="icon"
        change={change}
        onBusy={busy}
      />,
    );
    const input = screen.getByLabelText("Logo image file") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload logo image" }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, {
      target: { files: [new File(["png"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(change).toHaveBeenCalledWith(png));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/images/prepare",
      expect.objectContaining({ method: "POST" }),
    );
    expect(busy).toHaveBeenLastCalledWith(false);
  });
});
