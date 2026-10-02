import { useId, type ReactNode } from "react";
import { Server, LayoutGrid, PanelsTopLeft, ImagePlus } from "lucide-react";
import type { Config } from "./model";
import {
  contrast,
  defaultBackground,
  defaultGlass,
  gradients,
  palettes,
  type Background as BackgroundSettings,
} from "./appearance";
import ImageField from "./ImageField";

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
  section: "general" | "appearance" | "panes";
  draft: Config;
  change: (c: Config) => void;
  onBusy: (b: boolean) => void;
}) {
  const a = draft.appearance,
    b = a.background ?? defaultBackground,
    g = a.glass ?? defaultGlass,
    p = a.palette ?? palettes[a.theme];
  const header = (update: Partial<Config["dashboard"]>) =>
    change({ ...draft, dashboard: { ...draft.dashboard, ...update } });
  const appearance = (update: Partial<Config["appearance"]>) =>
    change({ ...draft, appearance: { ...a, ...update } });
  const background = (update: Partial<BackgroundSettings>) =>
    appearance({ background: { ...b, ...update } });
  const badContrast =
    contrast(p.text, p.surface) < 4.5 || contrast(p.text, p.background) < 4.5;

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
          description="Choose how your name and artwork appear in the header."
        >
          <div
            className="choice-row logo-choices"
            role="group"
            aria-label="Logo style"
          >
            <button
              type="button"
              aria-pressed={draft.dashboard.branding !== "logo"}
              onClick={() => header({ branding: "icon" })}
            >
              <span className="logo-choice-icon" aria-hidden="true">
                <LayoutGrid size={22} />
                <span>Dashboard</span>
              </span>
              Icon + name
            </button>
            <button
              type="button"
              aria-pressed={draft.dashboard.branding === "logo"}
              onClick={() => header({ branding: "logo" })}
            >
              <span className="logo-choice-wide" aria-hidden="true">
                Your logo
              </span>
              Full logo
            </button>
          </div>
          {draft.dashboard.branding !== "logo" && (
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
          <div className="settings-subsection">
            <h4>Custom image</h4>
            <ImageField
              label="Logo image"
              kind={draft.dashboard.branding === "logo" ? "logo" : "icon"}
              value={draft.dashboard.logo ?? ""}
              change={(logo) => header({ logo })}
              onBusy={onBusy}
              hint={
                draft.dashboard.branding === "logo"
                  ? "Rectangular logos replace the icon and name. PNG, JPEG or WebP."
                  : "Square artwork beside the name. PNG, JPEG or WebP."
              }
            />
          </div>
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
          <label className="setting-switch">
            <span>Navigation button labels</span>
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
        <Section
          title="Labels"
          description="Show names beneath app icons."
        >
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
              onClick={() => appearance({ theme, palette: undefined })}
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
        <div
          className="accent-swatches"
          role="group"
          aria-label="Accent colour"
        >
          {[
            ["Mint", palettes[a.theme].accent],
            ["Blue", "#7db7ff"],
            ["Violet", "#bca5ff"],
            ["Rose", "#ef9fb5"],
            ["Amber", "#efc06e"],
            ["Teal", "#72d4cc"],
          ].map(([name, colour]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={p.accent.toLowerCase() === colour}
              style={{
                background: colour,
                color:
                  contrast(colour, "#111720") >= 4.5 ? "#111720" : "#ffffff",
              }}
              onClick={() => appearance({ palette: { ...p, accent: colour } })}
            >
              {p.accent.toLowerCase() === colour ? "✓" : ""}
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
        title="Background"
        description="Pick a built-in look, or choose Custom for your own image."
      >
        <div
          className="background-gallery"
          role="group"
          aria-label="Background gallery"
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
          </div>
        )}
        {b.kind !== "none" && (
          <div className="settings-subsection">
            <h4>Adjustments</h4>
            <Range
              label="Background dimming"
              value={b.dimming}
              min={0}
              max={80}
              unit="%"
              change={(dimming) => background({ dimming })}
            />
            {b.kind === "image" && (
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
            )}
          </div>
        )}
        {(b.kind === "waves" || b.kind === "aurora") && (
          <div className="settings-subsection">
            <h4>Motion</h4>
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
            <p className="hint">Respects reduced-motion preferences.</p>
          </div>
        )}
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
