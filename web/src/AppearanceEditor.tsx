import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Server, LayoutGrid, PanelsTopLeft, ImagePlus, X } from "lucide-react";
import type { Config } from "./model";
import {
  contrast,
  defaultBackground,
  defaultGlass,
  gradients,
  defaultOverlayColour,
  migrateBackground,
  overlayForTheme,
  accentPresets,
  paletteForThemeChange,
  palettes,
  type Background as BackgroundSettings,
  type OverlayMode,
} from "./appearance";
import ImageField from "./ImageField";

function OverlayModeSwatch({
  id,
  label,
  pressed,
  className,
  onSelect,
}: {
  id: OverlayMode;
  label: string;
  pressed: boolean;
  className: string;
  onSelect: (id: OverlayMode) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`colour-tile overlay-swatch ${className}`}
      onClick={() => onSelect(id)}
    >
      <span className="colour-tile-paint" aria-hidden="true" />
      <span className="colour-tile-tick" aria-hidden="true">
        {pressed ? "✓" : ""}
      </span>
    </button>
  );
}

function ColourSwatch({
  label,
  colour,
  pressed = false,
  hueDefault = false,
  onSelect,
  onColour,
}: {
  label: string;
  colour: string;
  pressed?: boolean;
  /** HSL-style spectrum until a custom colour is chosen. */
  hueDefault?: boolean;
  onSelect?: () => void;
  onColour: (colour: string) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const colourInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(colour);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const portalHost =
    button.current?.closest("dialog") ??
    (typeof document !== "undefined" ? document.body : null);

  useEffect(() => {
    setHex(colour);
  }, [colour]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popover.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
    };
    // Defer so the opening click does not immediately dismiss.
    const timer = window.setTimeout(() => {
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("pointerdown", onPointer, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  const place = () => {
    const anchor = button.current;
    if (!anchor) return;
    const box = anchor.getBoundingClientRect();
    const host = anchor.closest("dialog");
    const origin = host?.getBoundingClientRect();
    const ox = origin?.left ?? 0;
    const oy = origin?.top ?? 0;
    const hostW = origin?.width ?? window.innerWidth;
    const hostH = origin?.height ?? window.innerHeight;
    const width = 220;
    const height = 120;
    const left = Math.min(
      Math.max(12, box.left - ox),
      hostW - width - 12,
    );
    const spaceBelow = (origin?.bottom ?? window.innerHeight) - box.bottom;
    const top =
      spaceBelow < height + 12
        ? Math.max(12, box.top - oy - height - 8)
        : box.bottom - oy + 8;
    setPos({ top, left });
  };

  const openPicker = () => {
    onSelect?.();
    place();
    setOpen(true);
    const el = colourInput.current;
    if (el && typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        /* Ignore if the browser blocks the picker. */
      }
    }
  };

  const applyHex = (value: string) => {
    const next = value.startsWith("#") ? value : `#${value}`;
    if (!/^#[a-fA-F0-9]{6}$/.test(next)) {
      setHex(colour);
      return;
    }
    setHex(next);
    onSelect?.();
    onColour(next.toLowerCase());
  };

  const onColourInput = (value: string) => {
    onSelect?.();
    onColour(value);
    setHex(value);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={pressed}
        aria-expanded={open}
        className="colour-tile overlay-swatch overlay-custom"
        onClick={openPicker}
      >
        <span
          className={`colour-tile-paint${hueDefault ? " overlay-custom-hue" : ""}`}
          style={hueDefault ? undefined : { background: colour }}
          aria-hidden="true"
        />
        <span className="colour-tile-tick" aria-hidden="true">
          {pressed ? "✓" : ""}
        </span>
      </button>
      <input
        ref={colourInput}
        type="color"
        className="colour-native-ghost"
        aria-hidden="true"
        tabIndex={-1}
        value={colour}
        onChange={(e) => onColourInput(e.target.value)}
      />
      {open &&
        portalHost &&
        createPortal(
          <div
            ref={popover}
            className="colour-popover"
            role="dialog"
            aria-label={label}
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="colour-popover-head">
              <strong>{label}</strong>
              <button
                type="button"
                className="icon-button"
                aria-label={`Close ${label} picker`}
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="colour-popover-body">
              <label className="colour-popover-swatch">
                <input
                  type="color"
                  aria-label={`Pick ${label}`}
                  value={colour}
                  onChange={(e) => onColourInput(e.target.value)}
                />
              </label>
              <label className="colour-popover-hex">
                <span>Hex</span>
                <input
                  type="text"
                  spellCheck={false}
                  maxLength={7}
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  onBlur={(e) => applyHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyHex((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </label>
            </div>
          </div>,
          portalHost,
        )}
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="settings-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {description && <p className="section-description">{description}</p>}
      {children}
    </section>
  );
}
function Range({
  label,
  value,
  min,
  max,
  unit = "",
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  change: (n: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
}

export default function AppearanceEditor({
  draft,
  change,
  onBusy,
  section,
}: {
  section: "general" | "appearance" | "background" | "panes";
  draft: Config;
  change: (c: Config) => void;
  onBusy: (b: boolean) => void;
}) {
  const accentHeadingId = useId();
  const a = draft.appearance,
    b = migrateBackground(a.background ?? defaultBackground, a.theme),
    g = a.glass ?? defaultGlass,
    p = a.palette ?? palettes[a.theme];
  const header = (update: Partial<Config["dashboard"]>) =>
    change({ ...draft, dashboard: { ...draft.dashboard, ...update } });
  const appearance = (update: Partial<Config["appearance"]>) =>
    change({ ...draft, appearance: { ...a, ...update } });
  const background = (update: Partial<BackgroundSettings>) =>
    appearance({ background: { ...b, ...update } });
  const setTheme = (theme: "dark" | "light") =>
    appearance({
      theme,
      palette: paletteForThemeChange(a.theme, theme, a.palette),
      background: {
        ...b,
        overlay: overlayForTheme(theme, b.overlay),
      },
    });
  const badContrast =
    contrast(p.text, p.surface) < 4.5 || contrast(p.text, p.background) < 4.5;
  const fullLogo = draft.dashboard.branding === "logo";
  const hasCustomLogo = Boolean(draft.dashboard.logo);

  if (section === "general")
    return (
      <>
        <Section
          title="Dashboard"
          description="Also used for the browser tab and accessible name."
        >
          <label>
            Dashboard name
            <input
              maxLength={100}
              value={draft.dashboard.title}
              onChange={(e) => header({ title: e.target.value })}
            />
          </label>
        </Section>
        <Section
          title="Logo"
          description="How your name and artwork appear in the header."
        >
          <div
            className="choice-row logo-choices"
            role="group"
            aria-label="Logo style"
          >
            <button
              type="button"
              aria-pressed={!fullLogo}
              onClick={() => header({ branding: "icon" })}
            >
              <span className="logo-choice-icon" aria-hidden="true">
                <LayoutGrid size={20} />
                <span>Name</span>
              </span>
              Icon + name
            </button>
            <button
              type="button"
              aria-pressed={fullLogo}
              onClick={() => header({ branding: "logo" })}
            >
              <span className="logo-choice-wide" aria-hidden="true">
                Logo
              </span>
              Full logo
            </button>
          </div>
          {!fullLogo && (
            <div className="settings-subsection">
              <h4>Built-in icons</h4>
              <div
                className="choice-row"
                role="group"
                aria-label="Built-in icons"
              >
                {(
                  [
                    ["grid", "Pane grid", LayoutGrid],
                    ["server", "Server", Server],
                    ["panels", "Panels", PanelsTopLeft],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={
                      !draft.dashboard.logo &&
                      (draft.dashboard.builtinIcon ?? "grid") === id
                    }
                    onClick={() => header({ builtinIcon: id, logo: "" })}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {fullLogo ? (
            <div className="settings-subsection">
              <ImageField
                label="Logo image"
                kind="logo"
                value={draft.dashboard.logo ?? ""}
                change={(logo) => header({ logo })}
                onBusy={onBusy}
                hint="Rectangular artwork replaces the icon and name. PNG, JPEG or WebP."
              />
            </div>
          ) : (
            <details
              className="settings-disclosure"
              open={hasCustomLogo || undefined}
            >
              <summary>Custom image</summary>
              <ImageField
                label="Logo image"
                kind="icon"
                value={draft.dashboard.logo ?? ""}
                change={(logo) => header({ logo })}
                onBusy={onBusy}
                hint="Square artwork beside the name. PNG, JPEG or WebP."
              />
            </details>
          )}
        </Section>
        <Section
          title="Workspace"
          description="Tiles keep their size. Narrow screens use a read-only layout."
        >
          <div className="fields">
            <label>
              Dashboard width
              <select
                value={
                  draft.dashboard.widthMode === "full"
                    ? "full"
                    : [960, 1200].includes(draft.dashboard.width)
                      ? String(draft.dashboard.width)
                      : "custom"
                }
                onChange={(e) =>
                  header({
                    widthMode: e.target.value === "full" ? "full" : "fixed",
                    width: ["960", "1200"].includes(e.target.value)
                      ? Number(e.target.value)
                      : e.target.value === "custom"
                        ? 1000
                        : draft.dashboard.width,
                  })
                }
              >
                <option value="full">Full width</option>
                <option value="960">960 px</option>
                <option value="1200">1200 px</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              {draft.dashboard.widthMode === "full"
                ? "Saved workspace width (px)"
                : "Width (px)"}
              <input
                type="number"
                min={768}
                max={3840}
                value={draft.dashboard.width}
                onChange={(e) => header({ width: Number(e.target.value) })}
              />
            </label>
          </div>
        </Section>
        <Section title="Navigation">
          <label className="setting-switch">
            <span>Show button labels</span>
            <input
              type="checkbox"
              role="switch"
              checked={a.showButtonLabels}
              onChange={(e) =>
                appearance({ showButtonLabels: e.target.checked })
              }
            />
          </label>
        </Section>
      </>
    );

  if (section === "panes")
    return (
      <>
        <Section
          title="Pane finish"
          description={
            g.mode === "glass"
              ? "Frosted surfaces with fully opaque text and icons."
              : "Opaque surfaces for a clear, uniform look."
          }
        >
          <div
            className="choice-row finish-choices"
            role="group"
            aria-label="Pane finish"
          >
            {(["solid", "glass"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={g.mode === mode}
                onClick={() => appearance({ glass: { ...g, mode } })}
              >
                {mode === "solid" ? "Solid" : "Glass"}
              </button>
            ))}
          </div>
        </Section>
        {g.mode === "glass" && (
          <Section
            title="Fine tuning"
            description="Transparency and blur for every pane."
          >
            <div className="settings-control-group">
              <Range
                label="Pane opacity"
                value={g.opacity}
                min={30}
                max={100}
                unit="%"
                change={(opacity) => appearance({ glass: { ...g, opacity } })}
              />
              <Range
                label="Glass blur"
                value={g.blur}
                min={0}
                max={24}
                unit="px"
                change={(blur) => appearance({ glass: { ...g, blur } })}
              />
            </div>
          </Section>
        )}
        <Section title="Labels" description="Show names beneath app icons.">
          <label className="setting-switch">
            <span>Show app labels</span>
            <input
              type="checkbox"
              role="switch"
              checked={a.showAppLabels}
              onChange={(e) => appearance({ showAppLabels: e.target.checked })}
            />
          </label>
        </Section>
      </>
    );

  if (section === "background")
    return (
      <>
        <Section
          title="Static"
          description="Solid colour, gradients, or your own image."
        >
          <div
            className="background-gallery"
            role="group"
            aria-label="Static backgrounds"
          >
            <button
              type="button"
              className="background-swatch"
              aria-pressed={b.kind === "none"}
              onClick={() => background({ kind: "none" })}
            >
              <span style={{ background: "var(--bg)" }} />
              None
            </button>
            {Object.entries(gradients).map(([id, gradient]) => (
              <button
                type="button"
                className="background-swatch"
                key={id}
                aria-pressed={b.kind === "gradient" && b.preset === id}
                onClick={() =>
                  background({
                    kind: "gradient",
                    preset: id as BackgroundSettings["preset"],
                  })
                }
              >
                <span style={{ background: gradient }} />
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
            <button
              type="button"
              className="background-swatch"
              aria-pressed={b.kind === "image"}
              onClick={() => background({ kind: "image" })}
            >
              <span
                className={`swatch-custom ${b.image ? "swatch-custom-set" : "swatch-custom-empty"}`}
              >
                <ImagePlus size={18} aria-hidden="true" />
              </span>
              Custom
            </button>
          </div>
          {b.kind === "image" && (
            <div className="settings-subsection">
              <ImageField
                label="Background image"
                kind="background"
                value={b.image}
                change={(image) =>
                  background({ image, kind: image ? "image" : "none" })
                }
                onBusy={onBusy}
                hint="PNG, JPEG or WebP, up to 8 MiB. Uploads are included in backups."
              />
              <label className="settings-row">
                <span>Image position</span>
                <select
                  value={b.position}
                  onChange={(e) =>
                    background({
                      position: e.target
                        .value as BackgroundSettings["position"],
                    })
                  }
                >
                  <option value="center">Centre</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
            </div>
          )}
        </Section>
        <Section
          title="Animated"
          description="Motion backgrounds. Improvements are still underway."
        >
          <div
            className="background-gallery"
            role="group"
            aria-label="Animated backgrounds"
          >
            {(["waves", "aurora"] as const).map((kind) => (
              <button
                type="button"
                className="background-swatch"
                key={kind}
                aria-pressed={b.kind === kind}
                onClick={() => background({ kind })}
              >
                <span
                  className={`swatch-${kind}`}
                  style={{ background: gradients[b.preset] }}
                />
                {kind === "waves" ? "Waves" : "Aurora"}
              </button>
            ))}
          </div>
          {(b.kind === "waves" || b.kind === "aurora") && (
            <div className="settings-subsection">
              <label className="settings-row">
                <span>Animation palette</span>
                <select
                  value={b.preset}
                  onChange={(e) =>
                    background({
                      preset: e.target.value as BackgroundSettings["preset"],
                    })
                  }
                >
                  {Object.keys(gradients).map((k) => (
                    <option key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setting-switch">
                <span>Enable background motion</span>
                <input
                  role="switch"
                  type="checkbox"
                  checked={b.motion}
                  onChange={(e) => background({ motion: e.target.checked })}
                />
              </label>
              {b.motion && (
                <Range
                  label="Motion intensity"
                  value={b.intensity}
                  min={0}
                  max={100}
                  unit="%"
                  change={(intensity) => background({ intensity })}
                />
              )}
            </div>
          )}
        </Section>
        {b.kind !== "none" && (
          <Section
            title="Overlay"
            description="Improve contrast over the background. Theme changes keep solid or gradient unless Custom is selected."
          >
            <div className="overlay-groups">
              <div className="overlay-group">
                <h4 className="overlay-group-label">Solid</h4>
                <div
                  className="overlay-swatches"
                  role="group"
                  aria-label="Solid overlays"
                >
                  <OverlayModeSwatch
                    id="dark-solid"
                    label="Dark solid"
                    pressed={b.overlay === "dark-solid"}
                    className="overlay-solid overlay-tone-dark"
                    onSelect={(id) => background({ overlay: id })}
                  />
                  <OverlayModeSwatch
                    id="light-solid"
                    label="Light solid"
                    pressed={b.overlay === "light-solid"}
                    className="overlay-solid overlay-tone-light"
                    onSelect={(id) => background({ overlay: id })}
                  />
                </div>
              </div>
              <div className="overlay-group">
                <h4 className="overlay-group-label">Gradient</h4>
                <div
                  className="overlay-swatches"
                  role="group"
                  aria-label="Gradient overlays"
                >
                  <OverlayModeSwatch
                    id="dark-gradient"
                    label="Dark gradient"
                    pressed={b.overlay === "dark-gradient"}
                    className="overlay-gradient overlay-tone-dark"
                    onSelect={(id) => background({ overlay: id })}
                  />
                  <OverlayModeSwatch
                    id="light-gradient"
                    label="Light gradient"
                    pressed={b.overlay === "light-gradient"}
                    className="overlay-gradient overlay-tone-light"
                    onSelect={(id) => background({ overlay: id })}
                  />
                </div>
              </div>
              <div className="overlay-group overlay-group-custom">
                <h4 className="overlay-group-label">Custom</h4>
                <div
                  className="overlay-swatches"
                  role="group"
                  aria-label="Custom overlay"
                >
                  <ColourSwatch
                    label="Custom colour"
                    colour={b.overlayColour}
                    pressed={b.overlay === "custom"}
                    hueDefault={
                      b.overlayColour.toLowerCase() ===
                      defaultOverlayColour(a.theme).toLowerCase()
                    }
                    onSelect={() => background({ overlay: "custom" })}
                    onColour={(overlayColour) =>
                      background({ overlay: "custom", overlayColour })
                    }
                  />
                </div>
              </div>
            </div>
            <Range
              label="Overlay opacity"
              value={b.overlayOpacity}
              min={0}
              max={80}
              unit="%"
              change={(overlayOpacity) => background({ overlayOpacity })}
            />
          </Section>
        )}
      </>
    );

  return (
    <>
      <Section
        title="Theme"
        description="Changing theme resets custom colours."
      >
        <div
          className="theme-choices choice-row"
          role="group"
          aria-label="Theme"
        >
          {(["dark", "light"] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              aria-pressed={a.theme === theme}
              onClick={() => setTheme(theme)}
            >
              <span
                className={`theme-thumbnail theme-${theme}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </span>
              {theme === "dark" ? "Midnight" : "Daylight"}
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="Colours"
        description="Accent is used for buttons, selections and focus."
      >
        <h4 className="overlay-group-label" id={accentHeadingId}>
          Accent
        </h4>
        <div
          className="accent-swatches"
          role="group"
          aria-labelledby={accentHeadingId}
        >
          {accentPresets[a.theme].map(({ name, colour }) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={p.accent.toLowerCase() === colour.toLowerCase()}
              className="accent-swatch"
              style={{ background: colour }}
              onClick={() => appearance({ palette: { ...p, accent: colour } })}
            >
              <span aria-hidden="true">
                {p.accent.toLowerCase() === colour.toLowerCase() ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
        <details className="settings-disclosure">
          <summary>Custom palette</summary>
          <div className="colour-grid">
            {(
              [
                ["background", "Page"],
                ["surface", "Pane surface"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={p[key]}
                  onChange={(e) =>
                    appearance({ palette: { ...p, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
          </div>
          <p className="hint">
            Text contrast is checked before saving. Check glass over images.
          </p>
        </details>
        {badContrast && (
          <p className="error" role="alert">
            Increase text contrast before applying.
          </p>
        )}
        <button
          type="button"
          className="text-button"
          disabled={!a.palette}
          onClick={() => appearance({ palette: undefined })}
        >
          Reset colours
        </button>
      </Section>
      <Section
        title="Typography"
        description="Inter is included with Pane. Applies to every pane title."
      >
        <label className="settings-row">
          <span>Pane title size (px)</span>
          <input
            type="number"
            min={14}
            max={22}
            value={a.paneTitleSize ?? 18}
            onChange={(e) =>
              appearance({ paneTitleSize: Number(e.target.value) })
            }
          />
        </label>
      </Section>
    </>
  );
}
