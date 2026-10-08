// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Config, sanitiseExport, validate } from "./model";
import {
  accentPresets,
  appearanceStyle,
  contrast,
  defaultBackground,
  defaultGlass,
  normaliseGlass,
  imageReference,
  migrateBackground,
  motionDurationSeconds,
  normaliseBackgroundImages,
  parseIntegerInput,
  paletteForThemeChange,
  palettes,
  prependBackgroundImage,
  SOLID_TINT_PERCENT,
  solidBackgroundPaint,
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
  it("parses integer inputs without committing empty or out-of-range values", () => {
    expect(parseIntegerInput("18", 14, 22)).toBe(18);
    expect(parseIntegerInput("", 14, 22)).toBeUndefined();
    expect(parseIntegerInput(" ", 14, 22)).toBeUndefined();
    expect(parseIntegerInput("13", 14, 22)).toBeUndefined();
    expect(parseIntegerInput("22.5", 14, 22)).toBeUndefined();
    expect(parseIntegerInput("960", 768, 3840)).toBe(960);
    expect(motionDurationSeconds(0)).toBe(80);
    expect(motionDurationSeconds(100)).toBe(6);
    expect(motionDurationSeconds(40)).toBe(50.4);
  });
  it("keeps motion duration stable while intensity changes during playback", () => {
    const r = render(
      <Background
        settings={{
          ...defaultBackground,
          kind: "image",
          image: png,
          images: [png],
          motion: true,
          motionStyle: "ken-burns",
          intensity: 40,
        }}
      />,
    );
    const scene = () => r.container.querySelector(".scene") as HTMLElement;
    expect(scene().style.getPropertyValue("--motion-duration")).toBe("50.4s");
    r.rerender(
      <Background
        settings={{
          ...defaultBackground,
          kind: "image",
          image: png,
          images: [png],
          motion: true,
          motionStyle: "ken-burns",
          intensity: 80,
        }}
      />,
    );
    // Strength updates immediately; duration stays put so CSS animations do not restart.
    expect(scene().style.getPropertyValue("--motion-duration")).toBe("50.4s");
    expect(scene().style.getPropertyValue("--motion-strength")).toBe("0.8");
    r.rerender(
      <Background
        settings={{
          ...defaultBackground,
          kind: "image",
          image: png,
          images: [png],
          motion: false,
          motionStyle: "none",
          intensity: 80,
        }}
      />,
    );
    expect(scene().style.getPropertyValue("--motion-duration")).toBe("20.8s");
  });
  it("mounts dynamic packs and migrates legacy waves", () => {
    const migrated = migrateBackground(
      {
        kind: "waves",
        intensity: 55,
        preset: "ocean",
      },
      "dark",
    );
    expect(migrated.kind).toBe("dynamic");
    expect(migrated.dynamicId).toBe("waves");
    expect(migrated.dynamicParams?.speed).toBe(55);
    expect(migrated.dynamicParams?.palette).toBe("ocean");
    expect(migrated.motionStyle).toBe("none");
    expect(
      migrateBackground({ kind: "dynamic", dynamicId: "diagonals" }, "dark").kind,
    ).toBe("none");
    const r = render(
      <Background
        settings={{
          ...defaultBackground,
          kind: "dynamic",
          dynamicId: "dust",
          dynamicParams: { speed: 35, seed: "#ff00a6", glow: 20 },
        }}
      />,
    );
    const host = r.container.querySelector(
      '.scene-dynamic[data-dynamic-id="dust"]',
    ) as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.style.getPropertyValue("--pane-seed")).toBe("#ff00a6");
  });
  it("keeps font and motion when visiting Appearance then Background", async () => {
    const cfg = config();
    cfg.appearance.fontFamily = "rubik";
    cfg.appearance.background = {
      ...defaultBackground,
      kind: "gradient",
      preset: "ocean",
      motion: false,
      motionStyle: "none",
    };
    validate(cfg);
    const previews: Config[] = [];
    render(
      <Settings
        config={cfg}
        apply={vi.fn()}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly={false}
        onPreview={(draft) => {
          if (draft) previews.push(draft);
        }}
      />,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const last = previews.at(-1)!;
    expect(last.appearance.fontFamily).toBe("rubik");
    expect(last.appearance.background?.motion).toBe(false);
    expect(last.appearance.background?.motionStyle).toBe("none");
  });
  it("applies settings when fontFamily was empty in the draft", () => {
    const apply = vi.fn();
    const broken = config();
    (broken.appearance as { fontFamily?: string }).fontFamily = "";
    render(
      <Settings
        config={broken}
        apply={apply}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("combobox", { name: "Font" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].appearance.fontFamily).toBeUndefined();
  });
  it("does not poison the settings draft when pane title size is cleared", () => {
    const apply = vi.fn();
    render(
      <Settings
        config={config()}
        apply={apply}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const field = screen.getByLabelText("Pane title size (px)");
    fireEvent.change(field, { target: { value: "" } });
    expect(screen.getByText(/whole number from 14 to 22/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].appearance.paneTitleSize).toBeUndefined();
  });
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
  it("pairs accent presets per theme with readable accent-button contrast", () => {
    for (const theme of ["dark", "light"] as const) {
      expect(accentPresets[theme][0].colour).toBe(palettes[theme].accent);
      for (const { colour } of accentPresets[theme]) {
        const ink =
          contrast(colour, "#000000") >= contrast(colour, "#ffffff")
            ? "#000000"
            : "#ffffff";
        expect(contrast(colour, ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      paletteForThemeChange("dark", "light", {
        ...palettes.dark,
        accent: "#7db7ff",
      }),
    ).toEqual({ ...palettes.light, accent: "#1d4f91" });
    expect(
      paletteForThemeChange("dark", "light", {
        ...palettes.dark,
        background: "#000000",
        accent: "#7db7ff",
      }),
    ).toBeUndefined();
  });
  it("uses clear theme-toned glass instead of solid surface paint", () => {
    const dark = appearanceStyle({
      theme: "dark",
      glass: { mode: "glass", opacity: 40, blur: 20 },
    }) as Record<string, string>;
    expect(dark["--surface-fill"]).toBe("rgba(255,255,255,0.128)");
    expect(dark["--surface-fill"]).not.toContain("26,34,46");
    expect(dark["--surface-filter"]).toContain("20px");
    expect(dark["--surface-filter"]).toContain("saturate(150%)");
    expect(dark["--surface-depth"]).toContain("14px 44px");
    expect(dark["--surface-depth"]).not.toContain("inset");
    expect(dark["--surface-shine"]).toContain("linear-gradient");
    expect(dark["--surface-rim"]).toContain("linear-gradient");
    expect(dark.opacity).toBeUndefined();
    const clear = appearanceStyle({
      theme: "dark",
      glass: { mode: "glass", opacity: 0, blur: 20 },
    }) as Record<string, string>;
    expect(clear["--surface-fill"]).toBe("rgba(255,255,255,0.000)");
    const light = appearanceStyle({
      theme: "light",
      glass: { mode: "glass", opacity: 40, blur: 20 },
    }) as Record<string, string>;
    expect(light["--surface-fill"]).toBe("rgba(255,255,255,0.288)");
    expect(Number(light["--surface-fill"].match(/[\d.]+(?=\)$)/)?.[0])).toBeGreaterThan(
      Number(dark["--surface-fill"].match(/[\d.]+(?=\)$)/)?.[0]),
    );
  });
  it("defaults glass fine tuning to a clear wash with full edge bend", () => {
    expect(defaultGlass).toMatchObject({
      opacity: 15,
      blur: 2,
      saturation: 75,
      displacement: 100,
      aberration: 60,
    });
  });
  it("folds legacy glass effect units onto the 0–100 controls", () => {
    expect(
      normaliseGlass({ mode: "glass", opacity: 0, blur: 2, displacement: 150, saturation: 157 }),
    ).toMatchObject({ displacement: 100, saturation: 79 });
    expect(() =>
      validateVisuals({
        theme: "dark",
        glass: { mode: "glass", opacity: 0, blur: 2, displacement: 151 },
      }),
    ).toThrow(/glass/i);
  });
  it("floors frost when displacement is on so refraction warps the backdrop", () => {
    const style = appearanceStyle({
      theme: "dark",
      glass: { mode: "glass", opacity: 0, blur: 0, displacement: 68 },
    }) as Record<string, string>;
    expect(style["--surface-filter"]).toContain("blur(6px)");
    const frosted = appearanceStyle({
      theme: "dark",
      glass: { mode: "glass", opacity: 0, blur: 18, displacement: 68 },
    }) as Record<string, string>;
    expect(frosted["--surface-filter"]).toContain("blur(18px)");
  });
  it("keeps solid finish free of glass rim tokens", () => {
    const style = appearanceStyle({
      theme: "dark",
      glass: { mode: "solid", opacity: 70, blur: 14 },
    }) as Record<string, string>;
    expect(style["--surface-fill"]).toBe("#1a222e");
    expect(style["--surface-filter"]).toBe("none");
    expect(style["--surface-shine"]).toBe("none");
    expect(style["--surface-rim"]).toBe("none");
  });
  it("maps selected UI fonts onto the cascade variable", () => {
    const style = appearanceStyle({
      theme: "dark",
      fontFamily: "oxanium",
    }) as Record<string, string>;
    expect(style["--ui-font"]).toBe("Oxanium");
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
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    expect(
      screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Panes" }));
    fireEvent.click(screen.getByRole("button", { name: "Glass" }));
    fireEvent.keyDown(screen.getByRole("slider", {name: "Opacity"}), {key: "Home"});
    for(let i=0; i<55; i++) fireEvent.keyDown(screen.getByRole("slider", {name: "Opacity"}), {key: "ArrowRight"});
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
  }, 15_000);
  it("lists dynamic packs and customizes declared controls", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(screen.getByRole("heading", { name: "Dynamic" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dust" }));
    expect(
      screen.getByRole("button", { name: "Dust" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Customize dynamic effect" }),
    );
    expect(screen.getByRole("slider", { name: "Speed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply.mock.calls[0][0].appearance.background).toMatchObject({
      kind: "dynamic",
      dynamicId: "dust",
    });
  }, 15_000);
  it("paints a dynamic pack colour during the drag and commits the draft once", async () => {
    const previews: Config[] = [];
    const background = {
      ...defaultBackground,
      kind: "dynamic" as const,
      dynamicId: "dust",
      dynamicParams: { seed: "#ff00a6", speed: 35, angle: 0, glow: 20 },
    };
    const cfg = config();
    cfg.appearance.background = background;
    render(
      <>
        <Background settings={background} />
        <Settings
          config={cfg}
          apply={vi.fn()}
          imported={vi.fn()}
          close={vi.fn()}
          readOnly={false}
          onPreview={(draft) => {
            if (draft) previews.push(draft);
          }}
        />
      </>,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Customize dynamic effect" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Colour" }));
    const input = await screen.findByLabelText("Pick Colour");
    const before = previews.length;
    fireEvent.input(input, { target: { value: "#112233" } });
    fireEvent.change(input, { target: { value: "#445566" } });
    const host = document.querySelector(
      '.scene-dynamic[data-dynamic-id="dust"]',
    ) as HTMLElement | null;
    expect(host?.style.getPropertyValue("--pane-seed")).toBe("#445566");
    expect(
      previews
        .slice(before)
        .some((draft) => draft.appearance.background?.dynamicParams?.seed === "#445566"),
    ).toBe(false);
    await waitFor(() => {
      expect(previews.at(-1)?.appearance.background?.dynamicParams?.seed).toBe(
        "#445566",
      );
    });
  });
  it("applies a solid colour wallpaper from the Colours strip", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    expect(screen.getByRole("heading", { name: "Colours" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(
      screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByText("Blue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply.mock.calls[0][0].appearance.background).toMatchObject({
      kind: "solid",
      colour: "#7db7ff",
    });
  });
  it("discards wallpaper preview when Close is used", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(
      screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("None")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply.mock.calls[0][0].appearance.background).toMatchObject({
      kind: "none",
    });
  });
  it("tints solid wallpaper over theme --bg instead of opaque fill", () => {
    const paint = solidBackgroundPaint("#7db7ff");
    expect(paint).toContain("color-mix");
    expect(paint).toContain("var(--bg)");
    expect(paint).toContain("#7db7ff");
    expect(paint).toContain(`${SOLID_TINT_PERCENT}%`);
    const { container } = render(
      <Background
        settings={{ ...defaultBackground, kind: "solid", colour: "#7db7ff" }}
      />,
    );
    expect(container.querySelector(".scene")?.getAttribute("style")).toContain(
      "color-mix",
    );
  });
  it("paints a custom tint during the drag and commits the draft once", async () => {
    const previews: Config[] = [];
    render(
      <>
        <Background
          settings={{ ...defaultBackground, kind: "solid", colour: "#a2cbbb" }}
        />
        <Settings
          config={config()}
          apply={vi.fn()}
          imported={vi.fn()}
          close={vi.fn()}
          readOnly={false}
          onPreview={(draft) => {
            if (draft) previews.push(draft);
          }}
        />
      </>,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom colour" }));
    const input = await screen.findByLabelText("Pick Custom colour");
    const before = previews.length;
    fireEvent.input(input, { target: { value: "#112233" } });
    fireEvent.change(input, { target: { value: "#445566" } });
    const sceneStyle = document.querySelector(".scene")?.getAttribute("style") ?? "";
    expect(sceneStyle).toContain("#445566");
    expect(
      previews.slice(before).some((draft) => draft.appearance.background?.colour === "#445566"),
    ).toBe(false);
    await waitFor(() => {
      expect(previews.at(-1)?.appearance.background).toMatchObject({
        kind: "solid",
        colour: "#445566",
      });
    });
  });
  it("paints a custom overlay during the drag and commits the draft once", async () => {
    const previews: Config[] = [];
    const background = {
      ...defaultBackground,
      kind: "gradient" as const,
      preset: "ocean" as const,
    };
    const cfg = config();
    cfg.appearance.background = background;
    render(
      <>
        <Background settings={background} />
        <Settings
          config={cfg}
          apply={vi.fn()}
          imported={vi.fn()}
          close={vi.fn()}
          readOnly={false}
          onPreview={(draft) => {
            if (draft) previews.push(draft);
          }}
        />
      </>,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Customize overlay" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom colour" }));
    const input = await screen.findByLabelText("Pick Custom colour");
    const before = previews.length;
    fireEvent.input(input, { target: { value: "#112233" } });
    fireEvent.change(input, { target: { value: "#445566" } });
    const overlayStyle =
      document.querySelector(".scene-overlay")?.getAttribute("style") ?? "";
    expect(overlayStyle).toContain("rgba(68, 85, 102, 0.25)");
    expect(
      previews
        .slice(before)
        .some((draft) => draft.appearance.background?.overlayColour === "#445566"),
    ).toBe(false);
    await waitFor(() => {
      expect(previews.at(-1)?.appearance.background).toMatchObject({
        overlay: "custom",
        overlayColour: "#445566",
      });
    });
  });
  it("keeps My images newest-first and does not reshuffle on select", () => {
    const a = png,
      b =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9Qz0AEYBxVSF+FAP/1B/8AAAAASUVORK5CYII=",
      c =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAGElEQVR42mNkYGD4z8DAwMgABXAGNgGwSgwAW0gD/QAAAABJRU5ErkJggg==";
    expect(imageReference(a) && imageReference(b) && imageReference(c)).toBe(true);
    expect(normaliseBackgroundImages(b, [a, b, c])).toEqual([a, b, c]);
    expect(
      migrateBackground(
        {
          ...defaultBackground,
          kind: "image",
          image: b,
          images: [a, b, c],
        },
        "dark",
      ).images,
    ).toEqual([a, b, c]);
    expect(prependBackgroundImage([a, b], c)).toEqual([c, a, b]);
    expect(normaliseBackgroundImages(png, [])).toEqual([png]);
    expect(normaliseBackgroundImages(png, [a, b, c])).toEqual([a, b, c]);
    const orphan =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVR42mNkYGD4z8DAwMgABXAGNgGwSgwAW0gD/QAAAABJRU5ErkJggg==";
    expect(imageReference(orphan)).toBe(true);
    expect(normaliseBackgroundImages(orphan, [a, b, c])).toEqual([
      orphan,
      a,
      b,
      c,
    ]);
  });
  it("keeps motion when switching from a preset background to Custom", () => {
    const apply = vi.fn(),
      c = config();
    c.appearance.background = {
      ...defaultBackground,
      kind: "gradient",
      image: png,
      motion: true,
      motionStyle: "drift",
    };
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
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all My images" }));
    fireEvent.click(screen.getByRole("button", { name: "My image 1" }));
    expect(
      screen.getByRole("button", { name: "My image 1" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("dialog", { name: "My images" })).toBeNull();
    expect(
      screen.getByRole("switch", { name: "Motion effects" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Customize motion" }));
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeTruthy();
    const style = screen.getByLabelText("Motion style");
    expect(style.textContent).toContain("Drift");
    fireEvent.keyDown(style, {key: "ArrowDown"});
    fireEvent.click(screen.getByRole("option", {name: "Ken Burns"}));
    fireEvent.keyDown(screen.getByRole("slider", {name: "Speed"}), {key: "Home"});
    for(let i=0; i<75; i++) fireEvent.keyDown(screen.getByRole("slider", {name: "Speed"}), {key: "ArrowRight"});
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelector(".settings-dialog--preview-adjust")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
    expect(apply.mock.calls[0][0].appearance.background).toMatchObject({
      kind: "image",
      motion: true,
      motionStyle: "ken-burns",
      intensity: 75,
    });
  }, 15_000);
  it("restores the prior background when the custom image popover is cancelled", () => {
    const c = config();
    c.appearance.background = {
      ...defaultBackground,
      kind: "gradient",
      preset: "ocean",
      image: png,
    };
    render(
      <Settings
        config={c}
        apply={vi.fn()}
        imported={vi.fn()}
        close={vi.fn()}
        readOnly={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    fireEvent.click(screen.getByRole("button", { name: "Change wallpaper" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all My images" }));
    fireEvent.click(screen.getByRole("button", { name: "Add photo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close custom image picker" }),
    );
    expect(
      screen.getByRole("button", { name: "My image 1" }).getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all Gradients" }));
    expect(
      screen.getByRole("button", { name: "Ocean" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("migrates legacy motion flags into motion styles", () => {
    const legacy = {
      kind: "image" as const,
      preset: "dusk" as const,
      image: png,
      overlay: "dark-solid" as const,
      overlayOpacity: 25,
      overlayColour: "#111720",
      position: "center" as const,
      motion: true,
      intensity: 40,
    };
    expect(migrateBackground(legacy, "dark").motionStyle).toBe("ken-burns");
    expect(
      migrateBackground({ ...legacy, kind: "waves", image: "" }, "dark")
        .motionStyle,
    ).toBe("none");
    expect(
      migrateBackground(
        { ...legacy, kind: "gradient", image: "", motion: true },
        "dark",
      ).motionStyle,
    ).toBe("drift");
  });
  it("does not persist a cancelled settings draft", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Choose logo image" }));
    fireEvent.change(screen.getByLabelText("Logo image URL"), {
      target: { value: "https://example.com/wordmark.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", {name: "Discard"}));
    expect(apply).not.toHaveBeenCalled();
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
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
        settings={{
          ...defaultBackground,
          kind: "gradient",
          motion: false,
          motionStyle: "none",
        }}
      />,
    );
    expect(r.container.querySelector(".motion-paused")).not.toBeNull();
    r.rerender(
      <Background
        settings={{
          ...defaultBackground,
          kind: "image",
          image: "https://example.com/broken.png",
          images: ["https://example.com/broken.png"],
          motion: true,
          motionStyle: "ken-burns",
        }}
      />,
    );
    expect(r.container.querySelector(".motion-paused")).toBeNull();
    expect(r.container.querySelector(".motion-ken-burns")).not.toBeNull();
    expect(r.container.querySelector(".scene-image")).not.toBeNull();
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

