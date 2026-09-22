import type { CSSProperties } from "react";
import { Server, LayoutGrid, PanelsTopLeft } from "lucide-react";
import type { Config } from "./model";
import {
  appearanceStyle,
  contrast,
  defaultBackground,
  defaultGlass,
  gradients,
  palettes,
  type Background as BackgroundSettings,
  type Palette,
} from "./appearance";
import Background from "./Background";
import { HeaderBrand } from "./BrandLogo";
import ImageField from "./ImageField";

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
        {label}{" "}
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
}: {
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
  return (
    <>
      <div
        className="appearance-preview"
        aria-label="Appearance preview"
        data-pane-style={g.mode}
        style={
          {
            ...appearanceStyle(a),
            "--pane-title-size": `${a.paneTitleSize ?? 18}px`,
          } as CSSProperties
        }
      >
        <Background settings={b} />
        <div className="preview-content">
          <div className="brand brand-preview" aria-label="Header preview">
            <HeaderBrand dashboard={draft.dashboard} />
          </div>
          <div className="preview-title">Your apps</div>
          <div className="pane preview-pane">
            <span className="preview-app">
              <Server />
              <small>Server</small>
            </span>
            <span className="preview-app">
              <LayoutGrid />
              <small>Apps</small>
            </span>
            <span className="preview-app">
              <PanelsTopLeft />
              <small>Media</small>
            </span>
          </div>
        </div>
        <span className="preview-caption">
          Live preview · changes apply to every pane
        </span>
      </div>
      <details className="appearance-section" open>
        <summary>Header branding</summary>
        <label>
          Header name
          <input
            maxLength={100}
            value={draft.dashboard.title}
            onChange={(e) => header({ title: e.target.value })}
          />
        </label>
        <p className="hint">
          Used for the browser tab and accessible name, even when a wide logo
          replaces the visible name.
        </p>
        <div className="choice-row" role="group" aria-label="Header style">
          <button
            type="button"
            aria-pressed={draft.dashboard.branding !== "logo"}
            onClick={() => header({ branding: "icon" })}
          >
            Square icon + name
          </button>
          <button
            type="button"
            aria-pressed={draft.dashboard.branding === "logo"}
            onClick={() => header({ branding: "logo" })}
          >
            Wide logo
          </button>
        </div>
        {draft.dashboard.branding !== "logo" && (
          <div className="choice-row" role="group" aria-label="Built-in icons">
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
        )}
        <ImageField
          label="Logo image"
          kind={draft.dashboard.branding === "logo" ? "logo" : "icon"}
          value={draft.dashboard.logo ?? ""}
          change={(logo) => header({ logo })}
          onBusy={onBusy}
        />
        <p className="hint">
          {draft.dashboard.branding === "logo"
            ? "Use a wide image with transparent padding trimmed. It replaces the icon and visible name; if it fails, the name and built-in icon return."
            : "Square artwork sits beside the name. Transparent PNGs work well. Built-in icons need no upload."}
        </p>
      </details>
      <details className="appearance-section">
        <summary>Background</summary>
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
        </div>
        <ImageField
          label="Background image"
          kind="background"
          value={b.image}
          change={(image) =>
            background({ image, kind: image ? "image" : "none" })
          }
          onBusy={onBusy}
        />
        {b.image && b.kind !== "image" && (
          <button type="button" onClick={() => background({ kind: "image" })}>
            Use custom image
          </button>
        )}
        {b.kind !== "none" && (
          <Range
            label="Background dimming"
            value={b.dimming}
            min={0}
            max={80}
            unit="%"
            change={(dimming) => background({ dimming })}
          />
        )}
        {b.kind === "image" && (
          <label>
            Image position
            <select
              value={b.position}
              onChange={(e) =>
                background({
                  position: e.target.value as BackgroundSettings["position"],
                })
              }
            >
              <option value="center">Centre</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        )}
        {(b.kind === "waves" || b.kind === "aurora") && (
          <>
            <label>
              Animation palette
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
            <label className="check">
              <input
                type="checkbox"
                checked={b.motion}
                onChange={(e) => background({ motion: e.target.checked })}
              />
              Enable background motion
            </label>
            <Range
              label="Motion intensity"
              value={b.intensity}
              min={0}
              max={100}
              unit="%"
              change={(intensity) => background({ intensity })}
            />
            <p className="hint">
              Motion pauses in hidden tabs and respects your device's
              reduced-motion setting.
            </p>
          </>
        )}
      </details>
      <details className="appearance-section">
        <summary>Pane finish · global</summary>
        <div className="choice-row" role="group" aria-label="Pane finish">
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
        {g.mode === "glass" && (
          <>
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
          </>
        )}
        <p className="hint">
          One finish for every pane—no per-pane overrides. Glass uses frosted
          blur, highlights and depth; unsupported browsers use a solid surface.
          Text and icons always remain fully opaque.
        </p>
      </details>
      <details className="appearance-section">
        <summary>Colours</summary>
        <label className="check">
          <input
            type="checkbox"
            checked={!!a.palette}
            onChange={(e) =>
              appearance({
                palette: e.target.checked
                  ? { ...palettes[a.theme] }
                  : undefined,
              })
            }
          />
          Custom colours
        </label>
        {a.palette && (
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
                    appearance({
                      palette: { ...p, [key]: e.target.value } as Palette,
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
        <p
          className={badContrast ? "error" : "hint"}
          role={badContrast ? "alert" : undefined}
        >
          {badContrast
            ? "Increase text contrast before applying."
            : "Page and solid-pane text colours must meet a 4.5:1 contrast ratio. Check readability over your chosen background when using glass."}
        </p>
        <button
          type="button"
          onClick={() =>
            appearance({
              palette: undefined,
              glass: undefined,
              background: undefined,
              paneTitleSize: 18,
              theme: "dark",
            })
          }
        >
          Reset appearance
        </button>
      </details>
    </>
  );
}
