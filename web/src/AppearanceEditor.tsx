import type { Dispatch, SetStateAction } from "react";
import type { RecentWallpaperEntry } from "./wallpaperRecent";
import { Button, Label, Input, Select, SelectOption, Popover, PopoverHead, ImagePopoverActions, Modal, Section, Range, Disclosure, Notice, TextField, SwitchRow, SettingsGroup, SettingsRow } from "./design/components";
import { useEffect, useRef, useState } from "react";
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
  builtinIconIds,
  resolveBuiltinIcon,
  type BuiltinIconId,
} from "./brandIcons";
import ImageField from "./ImageField";
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

function BrandImagePicker({title, kind, value, hint, triggerLabel, onBusy, onLive}: {
  title: string; kind: 'icon' | 'logo'; value: string; hint: string; triggerLabel: string; onBusy: (busy: boolean) => void; onLive: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), revert = useRef(value);
  const cancel = () => {if(busy) return; onLive(revert.current); setOpen(false);};
  return <Popover label={title} size="image" open={open} onOpenChange={next => {if(next) {revert.current = value; setOpen(true);} else cancel();}} trigger={<Button type="button">{triggerLabel}</Button>}>
    <PopoverHead title={title} closeLabel={`Close ${title.toLowerCase()} picker`} disabled={busy} onClose={cancel} />
    <ImageField label="Logo image" kind={kind} value={value} change={onLive} onBusy={v => {setBusy(v); onBusy(v);}} hint={hint} />
    <ImagePopoverActions cancel={cancel} confirm={() => {if(!busy) setOpen(false);}} />
  </Popover>;
}

function IconMarkPreview({
  icon,
  builtinIcon,
}: {
  icon: string;
  builtinIcon?: BuiltinIconId;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [icon]);
  const url = logoReference(icon) && icon ? icon : undefined;
  const Builtin = resolveBuiltinIcon(builtinIcon);
  return (
    <div className="logo-artwork-preview" aria-hidden="true">
      {url && !failed ? (
        <img
          className="logo-artwork-image"
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Builtin size={22} />
      )}
    </div>
  );
}

function WideLogoPreview({ logo }: { logo: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  const url = logoReference(logo) && logo ? logo : undefined;
  return (
    <div className="logo-artwork-preview logo-artwork-preview--wide" aria-hidden="true">
      {url && !failed ? (
        <img
          className="logo-artwork-image"
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="logo-artwork-wide-stub" />
      )}
    </div>
  );
}

function IconPickerDialog({
  builtinIcon,
  icon,
  onBusy,
  onBuiltin,
  onCustom,
  close,
}: {
  builtinIcon?: BuiltinIconId;
  icon: string;
  onBusy: (busy: boolean) => void;
  onBuiltin: (id: BuiltinIconId) => void;
  onCustom: (icon: string) => void;
  close: () => void;
}) {
  const selectedBuiltin = !icon ? (builtinIcon ?? "grid") : undefined;
  return (
    <Modal
      title="Choose icon"
      close={close}
      footer={
        <Button type="button" variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <div className="icon-picker-grid" role="group" aria-label="Built-in icons">
        {builtinIconIds.map((id) => {
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
              <Icon size={22} aria-hidden="true" />
            </Button>
          );
        })}
      </div>
      <div className="icon-picker-upload">
        <BrandImagePicker
          title="Custom icon"
          kind="icon"
          value={icon}
          triggerLabel={icon ? "Replace custom icon" : "Upload custom icon"}
          hint="Square artwork for the header mark. PNG, JPEG or WebP, up to 8 MiB."
          onBusy={onBusy}
          onLive={onCustom}
        />
        {icon ? (
          <Button
            type="button"
            variant="danger"
            className="logo-artwork-remove"
            onClick={() => onCustom("")}
          >
            Remove custom icon
          </Button>
        ) : null}
      </div>
    </Modal>
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
}: {
  section: "general" | "appearance" | "background" | "panes";
  draft: Config;
  change: (c: Config | ((prev: Config) => Config)) => void;
  onBusy: (b: boolean) => void;
  onPreviewAdjust?: (active: boolean) => void;
  recent: RecentWallpaperEntry[];
  setRecent: Dispatch<SetStateAction<RecentWallpaperEntry[]>>;
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
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const hasCustomLogo = Boolean(draft.dashboard.logo);
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
              <Input
                maxLength={100}
                value={draft.dashboard.title}
                aria-label="Page title"
                onChange={(e) => header({ title: e.target.value })}
              />
            </SettingsRow>
            <SettingsRow
              label="Icon"
              action={
                <Button
                  type="button"
                  variant="quiet"
                  className="settings-row-action"
                  aria-label={iconVisible ? "Hide icon" : "Show icon"}
                  onClick={() => header({ showIcon: !iconVisible })}
                >
                  {iconVisible ? "Hide" : "Show"}
                </Button>
              }
            >
              <div className="logo-artwork">
                <IconMarkPreview
                  icon={draft.dashboard.icon ?? ""}
                  builtinIcon={draft.dashboard.builtinIcon}
                />
                <div className="logo-artwork-actions">
                  <Button type="button" onClick={() => setIconPickerOpen(true)}>
                    Choose icon
                  </Button>
                </div>
              </div>
            </SettingsRow>
            <SettingsRow
              label="Custom logo"
              hint="PNG, JPEG or WebP, up to 8 MiB. Replaces the page title."
            >
              <div className="logo-artwork logo-artwork--row">
                <WideLogoPreview logo={draft.dashboard.logo ?? ""} />
                <div className="logo-artwork-actions">
                  <BrandImagePicker
                    title="Custom logo"
                    kind="logo"
                    value={draft.dashboard.logo ?? ""}
                    triggerLabel={hasCustomLogo ? "Replace logo" : "Upload logo"}
                    hint="Drop a rectangular image or paste an HTTP(S) URL."
                    onBusy={onBusy}
                    onLive={(logo) => header({ logo })}
                  />
                </div>
                {hasCustomLogo ? (
                  <Button
                    type="button"
                    variant="danger"
                    className="logo-artwork-remove"
                    onClick={() => header({ logo: "" })}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </SettingsRow>
          </SettingsGroup>
        </Section>
        {iconPickerOpen ? (
          <IconPickerDialog
            builtinIcon={draft.dashboard.builtinIcon}
            icon={draft.dashboard.icon ?? ""}
            onBusy={onBusy}
            onBuiltin={(id) => header({ builtinIcon: id, icon: "" })}
            onCustom={(icon) => header({ icon })}
            close={() => setIconPickerOpen(false)}
          />
        ) : null}
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
          <Disclosure title="Custom palette">
            <div className="colour-grid">
              {(
                [
                  ["background", "Page"],
                  ["surface", "Pane surface"],
                  ["text", "Text"],
                  ["accent", "Accent"],
                ] as const
              ).map(([key, label]) => (
                <Label key={key}>
                  {label}
                  <Input
                    type="color"
                    value={p[key]}
                    onChange={(e) =>
                      appearance({ palette: { ...p, [key]: e.target.value } })
                    }
                  />
                </Label>
              ))}
            </div>
          </Disclosure>
          {badContrast && (
            <SettingsRow>
              <Notice tone="error">
                Increase text contrast before applying.
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
