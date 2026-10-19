import type { Dispatch, SetStateAction } from "react";
import type { RecentWallpaperEntry } from "./wallpaperRecent";
import { Button, ColourField, Label, Input, Select, SelectOption, Popover, PopoverHead, ImagePopoverActions, Section, Range, Disclosure, Notice, TextField, SwitchRow, SettingsGroup, SettingsRow } from "./design/components";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Config } from "./model";
import {
  contrast,
  defaultBackground,
  defaultGlass,
  logoReference,
  normaliseBackground,
  normaliseGlass,
  accentPresets,
  parseIntegerInput,
  paletteForThemeChange,
  palettes,
  resolveUiFont,
  uiFontFamily,
  uiFonts,
  type Background as BackgroundConfig,
  type UiFont,
} from "./appearance";
import {
  inlineBuiltinIconIds,
  resolveBuiltinIcon,
  type BuiltinIconId,
} from "./brandIcons";
import { prepareUpload } from "./services/media";
import BackgroundSettings from "./BackgroundSettings";

/** Keep invalid keystrokes out of the draft; only commit in-range integers. */
function IntegerField({
  label,
  value,
  min,
  max,
  onCommit,
  hint,
  hideLabel = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  hint?: string;
  /** When true, render a bare input (label lives outside, e.g. General split rows). */
  hideLabel?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const parsed = parseIntegerInput(text, min, max);
  const error =
    parsed === undefined
      ? `Enter a whole number from ${min} to ${max}.`
      : undefined;
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);
    const n = parseIntegerInput(next, min, max);
    if (n !== undefined) onCommit(n);
  };
  const onBlur = () => {
    if (parseIntegerInput(text, min, max) === undefined) setText(String(value));
  };
  if (hideLabel) {
    return (
      <div className={error ? "settings-split-field settings-split-field--invalid" : "settings-split-field"}>
        <Input
          type="number"
          min={min}
          max={max}
          value={text}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          onChange={onChange}
          onBlur={onBlur}
        />
        {error ? <span className="ui-field-error">{error}</span> : null}
      </div>
    );
  }
  return (
    <TextField
      label={label}
      type="number"
      min={min}
      max={max}
      value={text}
      hint={hint}
      error={error}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}

/** URL-only popover for Custom logo; file upload uses the inline drop target. */
function BrandUrlPicker({
  value,
  onLive,
}: {
  value: string;
  onLive: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const revert = useRef(value);
  const keepDraft = useRef(false);
  const uploaded =
    value.startsWith("/media/assets/") || value.startsWith("/media/staging/");
  const cancel = () => {
    keepDraft.current = false;
    onLive(revert.current);
    setOpen(false);
  };
  const confirm = () => {
    keepDraft.current = true;
    setOpen(false);
  };
  return (
    <Popover
      label="Paste logo URL"
      size="image"
      open={open}
      onOpenChange={(next) => {
        if (next) {
          keepDraft.current = false;
          revert.current = value;
          setOpen(true);
          return;
        }
        if (!keepDraft.current) onLive(revert.current);
        keepDraft.current = false;
        setOpen(false);
      }}
      trigger={
        <Button type="button" variant="quiet" className="settings-row-action">
          From URL
        </Button>
      }
    >
      <PopoverHead
        title="Custom logo"
        closeLabel="Close custom logo URL picker"
        onClose={cancel}
      />
      <Label className="image-url-field">
        <span>From URL</span>
        <Input
          type="url"
          maxLength={2048}
          placeholder="https://example.com/image.png"
          aria-label="Logo image URL"
          value={uploaded ? "" : value}
          onChange={(e) => onLive(e.target.value)}
        />
      </Label>
      {value && !logoReference(value) && !uploaded ? (
        <Notice tone="error">Enter a valid HTTP(S) image URL.</Notice>
      ) : null}
      <p className="hint">
        Remote URLs stay as links; file drops on the preview become local media assets.
      </p>
      <ImagePopoverActions cancel={cancel} confirm={confirm} />
    </Popover>
  );
}

/** ImageField-style dropzone in the Custom logo control column. */
function LogoDropTarget({
  logo,
  onLive,
  onBusy,
}: {
  logo: string;
  onLive: (logo: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => setFailed(false), [logo]);
  const take = async (file: File) => {
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const committed = await prepareUpload(file, "logo");
      onLive(committed.path);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  const url = logoReference(logo) && logo ? logo : undefined;
  const showArt = Boolean(url && !failed);
  return (
    <div className="logo-drop-field">
      <Button
        type="button"
        variant="surface"
        className="image-dropzone logo-drop-target"
        data-drag={drag ? "true" : undefined}
        aria-label={logo ? "Replace custom logo" : "Upload custom logo"}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void take(file);
        }}
      >
        {busy ? (
          <span className="image-dropzone-title">Uploading…</span>
        ) : showArt ? (
          <>
            <img
              className="logo-drop-preview"
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
            <span className="image-dropzone-title">
              Drop to replace, or click to browse
            </span>
            <span className="image-dropzone-hint">
              PNG, JPEG or WebP, up to 8 MiB.
            </span>
          </>
        ) : (
          <>
            <Upload size={28} aria-hidden="true" />
            <span className="image-dropzone-title">
              Drop an image here, or click to browse
            </span>
            <span className="image-dropzone-hint">
              PNG, JPEG or WebP, up to 8 MiB.
            </span>
          </>
        )}
      </Button>
      <Input
        ref={input}
        className="file-picker"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Custom logo file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void take(file);
        }}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** Inline 2×6 builtins with a square custom-upload drop matching the grid height. */
function IconBrandControl({
  builtinIcon,
  icon,
  onBuiltin,
  onCustom,
  onBusy,
}: {
  builtinIcon?: BuiltinIconId;
  icon: string;
  onBuiltin: (id: BuiltinIconId) => void;
  onCustom: (path: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => setFailed(false), [icon]);
  const take = async (file: File) => {
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const committed = await prepareUpload(file, "icon");
      onCustom(committed.path);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  const url = logoReference(icon) && icon ? icon : undefined;
  const showArt = Boolean(url && !failed);
  const selectedBuiltin = !icon ? (builtinIcon ?? "grid") : undefined;
  return (
    <div className="icon-brand-control">
      <div className="icon-brand-main">
        <div
          className="icon-picker-grid icon-picker-grid--inline"
          role="group"
          aria-label="Built-in icons"
        >
          {inlineBuiltinIconIds.map((id) => {
            const Icon = resolveBuiltinIcon(id);
            return (
              <Button
                key={id}
                type="button"
                variant="surface"
                className="icon-picker-tile"
                aria-label={id}
                aria-pressed={selectedBuiltin === id}
                onClick={() => onBuiltin(id)}
              >
                <Icon size={18} aria-hidden="true" />
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="surface"
          className="icon-custom-square"
          data-drag={drag ? "true" : undefined}
          data-filled={showArt ? "true" : undefined}
          aria-label={
            busy
              ? "Uploading custom icon"
              : showArt
                ? "Replace custom icon"
                : "Upload custom icon"
          }
          aria-pressed={showArt}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void take(file);
          }}
        >
          {busy ? (
            <span className="icon-custom-square-label">Uploading…</span>
          ) : showArt ? (
            <img
              className="icon-custom-square-preview"
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          ) : (
            <>
              <Upload size={20} aria-hidden="true" />
              <span className="icon-custom-square-label">Your own</span>
            </>
          )}
        </Button>
      </div>
      <Input
        ref={input}
        className="file-picker"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Custom icon file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void take(file);
        }}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

export default function AppearanceEditor({
  draft,
  change,
  onBusy,
  section,
  onPreviewAdjust,
  recent,
  setRecent,
  fieldErrors = {},
  openDisclosures = [],
  onDisclosureOpen,
}: {
  section: "general" | "appearance" | "background" | "panes";
  draft: Config;
  change: (c: Config | ((prev: Config) => Config)) => void;
  onBusy: (b: boolean) => void;
  onPreviewAdjust?: (active: boolean) => void;
  recent: RecentWallpaperEntry[];
  setRecent: Dispatch<SetStateAction<RecentWallpaperEntry[]>>;
  fieldErrors?: Record<string, string>;
  openDisclosures?: string[];
  onDisclosureOpen?: (title: string, open: boolean) => void;
}) {
  const a = draft.appearance,
    b = normaliseBackground(a.background ?? defaultBackground),
    g = normaliseGlass(a.glass ?? defaultGlass),
    p = a.palette ?? palettes[a.theme];
  const header = (update: Partial<Config["dashboard"]>) =>
    change((prev) => ({
      ...prev,
      dashboard: { ...prev.dashboard, ...update },
    }));
  const appearance = (update: Partial<Config["appearance"]>) =>
    change((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...update },
    }));
  const setGlass = (update: Partial<typeof g>) =>
    change((prev) => {
      const glass = normaliseGlass(prev.appearance.glass ?? defaultGlass);
      return {
        ...prev,
        appearance: { ...prev.appearance, glass: { ...glass, ...update } },
      };
    });
  const background = (update: Partial<BackgroundConfig>) =>
    change((prev) => {
      const cur = normaliseBackground(
        prev.appearance.background ?? defaultBackground,
      );
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          background: normaliseBackground({ ...cur, ...update }),
        },
      };
    });
  const setTheme = (theme: "dark" | "light") =>
    change((prev) => {
      const appearance = prev.appearance;
      return {
        ...prev,
        appearance: {
          ...appearance,
          theme,
          palette: paletteForThemeChange(
            appearance.theme,
            theme,
            appearance.palette,
          ),
          background: normaliseBackground(
            appearance.background ?? defaultBackground,
          ),
        },
      };
    });
  const badContrast =
    contrast(p.text, p.surface) < 4.5 || contrast(p.text, p.background) < 4.5;
  const hasCustomLogo = Boolean(draft.dashboard.logo);
  const hasCustomIcon = Boolean(draft.dashboard.icon);
  const titleVisible = hasCustomLogo
    ? true
    : draft.dashboard.showTitle !== false;
  const iconVisible = draft.dashboard.showIcon !== false;

  if (section === "general")
    return (
      <>
        <Section
          level="h3"
          className="settings-section"
          title="Branding"
          tip="Page title also sets the browser tab. Optional wide logo replaces the title."
        >
          <SettingsGroup>
            <SettingsRow
              label="Page title"
              hint={
                hasCustomLogo
                  ? "Custom logo replaces the page title."
                  : undefined
              }
              action={
                <Button
                  type="button"
                  variant="quiet"
                  className="settings-row-action"
                  disabled={hasCustomLogo}
                  aria-label={
                    titleVisible ? "Hide page title" : "Show page title"
                  }
                  onClick={() => header({ showTitle: !titleVisible })}
                >
                  {titleVisible ? "Hide" : "Show"}
                </Button>
              }
            >
              <>
                <Input
                  maxLength={100}
                  value={draft.dashboard.title}
                  aria-label="Page title"
                  data-settings-field="dashboard.title"
                  aria-invalid={fieldErrors["dashboard.title"] ? true : undefined}
                  aria-describedby={
                    fieldErrors["dashboard.title"]
                      ? "dashboard.title-error"
                      : undefined
                  }
                  onChange={(e) => header({ title: e.target.value })}
                />
                {fieldErrors["dashboard.title"] && (
                  <p
                    className="ui-field-error"
                    id="dashboard.title-error"
                    role="alert"
                  >
                    {fieldErrors["dashboard.title"]}
                  </p>
                )}
              </>
            </SettingsRow>
            <SettingsRow
              className="icon-brand-row"
              label="Icon"
              action={
                <div className="settings-row-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    className="settings-row-action"
                    aria-label={iconVisible ? "Hide icon" : "Show icon"}
                    onClick={() => header({ showIcon: !iconVisible })}
                  >
                    {iconVisible ? "Hide" : "Show"}
                  </Button>
                  {hasCustomIcon ? (
                    <Button
                      type="button"
                      variant="quiet"
                      className="settings-row-action"
                      aria-label="Remove custom icon"
                      onClick={() => header({ icon: "" })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              }
            >
              <IconBrandControl
                builtinIcon={draft.dashboard.builtinIcon}
                icon={draft.dashboard.icon ?? ""}
                onBusy={onBusy}
                onBuiltin={(id) => header({ builtinIcon: id, icon: "" })}
                onCustom={(icon) => header({ icon })}
              />
            </SettingsRow>
            <SettingsRow
              className="logo-drop-row"
              label="Custom logo"
              hint="PNG, JPEG or WebP, up to 8 MiB. Replaces the page title."
              action={
                <div className="settings-row-actions">
                  {hasCustomLogo ? (
                    <Button
                      type="button"
                      variant="quiet"
                      className="settings-row-action"
                      aria-label="Remove custom logo"
                      onClick={() => header({ logo: "" })}
                    >
                      Remove
                    </Button>
                  ) : null}
                  <BrandUrlPicker
                    value={draft.dashboard.logo ?? ""}
                    onLive={(logo) => header({ logo })}
                  />
                </div>
              }
            >
              <LogoDropTarget
                logo={draft.dashboard.logo ?? ""}
                onBusy={onBusy}
                onLive={(logo) => header({ logo })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
        <Section
          level="h3"
          className="settings-section"
          title="Labels"
          tip="Show or hide text beside header actions and under app icons."
        >
          <SettingsGroup>
            <SwitchRow
              label="Header buttons"
              checked={a.showButtonLabels}
              onCheckedChange={(checked) =>
                appearance({ showButtonLabels: checked })
              }
            />
            <SwitchRow
              label="App tiles"
              checked={a.showAppLabels}
              onCheckedChange={(checked) =>
                appearance({ showAppLabels: checked })
              }
            />
          </SettingsGroup>
        </Section>
        <Section
          level="h3"
          className="settings-section"
          title="Workspace"
          tip="Tiles keep their size. Narrow screens use a read-only layout."
        >
          <SettingsGroup>
            <SettingsRow label="Dashboard width">
              <Select
                aria-label="Dashboard width"
                value={
                  draft.dashboard.widthMode === "full"
                    ? "full"
                    : [960, 1200].includes(draft.dashboard.width)
                      ? String(draft.dashboard.width)
                      : "custom"
                }
                onValueChange={(value) =>
                  header({
                    widthMode: value === "full" ? "full" : "fixed",
                    width: ["960", "1200"].includes(value)
                      ? Number(value)
                      : value === "custom"
                        ? 1000
                        : draft.dashboard.width,
                  })
                }
              >
                <SelectOption value="full">Full width</SelectOption>
                <SelectOption value="960">960 px</SelectOption>
                <SelectOption value="1200">1200 px</SelectOption>
                <SelectOption value="custom">Custom</SelectOption>
              </Select>
            </SettingsRow>
            <SettingsRow
              label={
                draft.dashboard.widthMode === "full" ? "Saved width" : "Width"
              }
              hint="Whole pixels from 768 to 3840."
            >
              <IntegerField
                label={
                  draft.dashboard.widthMode === "full"
                    ? "Saved workspace width (px)"
                    : "Width (px)"
                }
                hideLabel
                min={768}
                max={3840}
                value={draft.dashboard.width}
                onCommit={(width) => header({ width })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
      </>
    );

  if (section === "panes")
    return (
      <>
        <Section level="h3" className="settings-section"
          title="Pane finish"
          tip={
            g.mode === "glass"
              ? "Clear panes with edge refraction where supported; text and icons stay opaque. Try low opacity and blur around 16–20 px."
              : "Opaque surfaces for a clear, uniform look."
          }
        >
          <div
            className="choice-row finish-choices"
            role="group"
            aria-label="Pane finish"
          >
            {(["solid", "glass"] as const).map((mode) => (
              <Button
                type="button"
                key={mode}
                aria-pressed={g.mode === mode}
                onClick={() => setGlass({ mode })}
              >
                {mode === "solid" ? "Solid" : "Glass"}
              </Button>
            ))}
          </div>
        </Section>
        {g.mode === "glass" && (
          <Section level="h3" className="settings-section"
            title="Fine tuning"
            tip="Adjust the transparency, blur and refraction of glass panes."
          >
            <SettingsGroup>
              <Range
                label="Opacity"
                value={g.opacity}
                min={0}
                max={100}
                unit="%"
                change={(opacity) => setGlass({ opacity })}
              />
              <Range
                label="Blur"
                value={g.blur}
                min={0}
                max={24}
                unit="px"
                change={(blur) => setGlass({ blur })}
              />
              <Range
                label="Saturation"
                value={g.saturation}
                min={0}
                max={100}
                unit="%"
                change={(saturation) => setGlass({ saturation })}
              />
              <Range
                label="Displacement"
                value={g.displacement}
                min={0}
                max={100}
                unit="%"
                change={(displacement) => setGlass({ displacement })}
              />
              <Range
                label="Chromatic aberration"
                value={g.aberration}
                min={0}
                max={100}
                unit="%"
                change={(aberration) => setGlass({ aberration })}
              />
            </SettingsGroup>
          </Section>
        )}
      </>
    );

  if (section === "background")
    return (
      <BackgroundSettings
        recent={recent}
        setRecent={setRecent}
        settings={b}
        theme={a.theme}
        onBusy={onBusy}
        background={background}
        onPreviewAdjust={onPreviewAdjust}
      />
    );

  return (
    <>
      <Section level="h3" className="settings-section"
        title="Theme"
        tip="Changing theme resets custom colours."
      >
        <div
          className="theme-choices choice-row"
          role="group"
          aria-label="Theme"
        >
          {(["dark", "light"] as const).map((theme) => (
            <Button
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
            </Button>
          ))}
        </div>
      </Section>
      <Section level="h3" className="settings-section"
        title="Colours"
        tip="Accent is used for buttons, selections and focus. Text contrast is checked before saving. Check glass over images."
      >
        <SettingsGroup>
          <SettingsRow label="Accent">
            <div
              className="accent-swatches"
              role="group"
              aria-label="Accent"
            >
              {accentPresets[a.theme].map(({ name, colour }) => (
                <Button variant="surface"
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
                </Button>
              ))}
            </div>
          </SettingsRow>
          <Disclosure
            title="Custom palette"
            open={openDisclosures.includes("Custom palette")}
            onOpenChange={(open) => onDisclosureOpen?.("Custom palette", open)}
          >
            {(
              [
                ["background", "Page"],
                ["surface", "Pane surface"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <ColourField
                key={key}
                label={label}
                colour={p[key]}
                fieldPath={`appearance.palette.${key}`}
                error={
                  key === "text"
                    ? fieldErrors["appearance.palette.text"]
                    : fieldErrors[`appearance.palette.${key}`]
                }
                onColour={(colour) =>
                  appearance({ palette: { ...p, [key]: colour } })
                }
              />
            ))}
          </Disclosure>
          {badContrast && !fieldErrors["appearance.palette.text"] && (
            <SettingsRow>
              <Notice tone="error">
                {! (contrast(p.text, p.surface) >= 4.5) &&
                !(contrast(p.text, p.background) >= 4.5)
                  ? "Text needs at least 4.5:1 contrast against the page and pane colours."
                  : !(contrast(p.text, p.surface) >= 4.5)
                    ? "Text needs at least 4.5:1 contrast against the pane surface colour."
                    : "Text needs at least 4.5:1 contrast against the page colour."}
              </Notice>
            </SettingsRow>
          )}
          <SettingsRow>
            <Button variant="surface"
              type="button"
              className="text-button"
              disabled={!a.palette}
              onClick={() => appearance({ palette: undefined })}
            >
              Reset colours
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </Section>
      <Section level="h3" className="settings-section"
        title="Typography"
        tip="Bundled typefaces for the whole dashboard. Pane titles also use the size below."
      >
        <SettingsGroup>
          <SettingsRow label="Font">
            <Select
              value={resolveUiFont(a.fontFamily)}
              style={{ fontFamily: uiFontFamily(resolveUiFont(a.fontFamily)) }}
              aria-label="Font"
              onValueChange={(value) => {
                if (!uiFonts.some((font) => font.id === value)) return;
                appearance({ fontFamily: value as UiFont });
              }}
            >
              {uiFonts.map((font) => (
                <SelectOption
                  key={font.id}
                  value={font.id}
                  style={{ fontFamily: font.family }}
                >
                  {font.label}
                </SelectOption>
              ))}
            </Select>
          </SettingsRow>
          <SettingsRow>
            <IntegerField
              label="Pane title size (px)"
              min={14}
              max={22}
              value={a.paneTitleSize ?? 18}
              onCommit={(paneTitleSize) => appearance({ paneTitleSize })}
            />
          </SettingsRow>
        </SettingsGroup>
      </Section>
    </>
  );
}
