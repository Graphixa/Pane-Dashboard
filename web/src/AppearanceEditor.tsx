import { Button, Label, Input, Select, SelectOption, Popover, PopoverHead, ImagePopoverActions, Section, Range, Disclosure, Notice, TextField, SwitchRow, SettingsGroup, SettingsRow } from "./design/components";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { Server, LayoutGrid, PanelsTopLeft, ImagePlus } from "lucide-react";
import type { Config } from "./model";
import {
  contrast,
  defaultBackground,
  defaultGlass,
  migrateBackground,
  normaliseGlass,
  overlayForTheme,
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const parsed = parseIntegerInput(text, min, max);
  const error =
    parsed === undefined
      ? `Enter a whole number from ${min} to ${max}.`
      : undefined;
  return (
    <TextField
      label={label}
      type="number"
      min={min}
      max={max}
      value={text}
      hint={hint}
      error={error}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const n = parseIntegerInput(next, min, max);
        if (n !== undefined) onCommit(n);
      }}
      onBlur={() => {
        if (parseIntegerInput(text, min, max) === undefined) setText(String(value));
      }}
    />
  );
}

function BrandImagePicker({title, kind, value, hint, triggerLabel, onBusy, onLive}: {
  title: string; kind: 'icon' | 'logo'; value: string; hint: string; triggerLabel: string; onBusy: (busy: boolean) => void; onLive: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), revert = useRef(value);
  const cancel = () => {if(busy) return; onLive(revert.current); setOpen(false);};
  return <Popover label={title} size="image" open={open} onOpenChange={next => {if(next) {revert.current = value; setOpen(true);} else cancel();}} trigger={<Button><ImagePlus size={16} aria-hidden="true" />{triggerLabel}</Button>}>
    <PopoverHead title={title} closeLabel={`Close ${title.toLowerCase()} picker`} disabled={busy} onClose={cancel} />
    <ImageField label="Logo image" kind={kind} value={value} change={onLive} onBusy={v => {setBusy(v); onBusy(v);}} hint={hint} />
    <ImagePopoverActions cancel={cancel} confirm={() => {if(!busy) setOpen(false);}} />
  </Popover>;
}

export default function AppearanceEditor({
  draft,
  change,
  onBusy,
  section,
  onPreviewAdjust,
}: {
  section: "general" | "appearance" | "background" | "panes";
  draft: Config;
  change: (c: Config | ((prev: Config) => Config)) => void;
  onBusy: (b: boolean) => void;
  onPreviewAdjust?: (active: boolean) => void;
}) {
  const a = draft.appearance,
    b = migrateBackground(a.background ?? defaultBackground, a.theme),
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
    change((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        background: {
          ...(prev.appearance.background ?? defaultBackground),
          ...update,
        },
      },
    }));
  const setTheme = (theme: "dark" | "light") =>
    change((prev) => {
      const appearance = prev.appearance;
      const migrated = migrateBackground(
        appearance.background ?? defaultBackground,
        appearance.theme,
      );
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
          background: {
            ...migrated,
            overlay: overlayForTheme(theme, migrated.overlay),
          },
        },
      };
    });
  const badContrast =
    contrast(p.text, p.surface) < 4.5 || contrast(p.text, p.background) < 4.5;
  const fullLogo = draft.dashboard.branding === "logo";

  if (section === "general")
    return (
      <>
        <Section level="h3" className="settings-section"
          title="Dashboard"
          description="Also used for the browser tab and accessible name."
        >
          <SettingsGroup>
            <SettingsRow>
              <TextField
                label="Dashboard name"
                maxLength={100}
                value={draft.dashboard.title}
                onChange={(e) => header({ title: e.target.value })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
        <Section level="h3" className="settings-section"
          title="Logo"
          description="How your name and artwork appear in the header."
        >
          <SettingsGroup>
            <SettingsRow>
              <div
                className="choice-row logo-choices"
                role="group"
                aria-label="Logo style"
              >
                <Button
                  type="button"
                  aria-pressed={!fullLogo}
                  onClick={() => header({ branding: "icon" })}
                >
                  <span className="logo-choice-icon" aria-hidden="true">
                    <LayoutGrid size={20} />
                    <span>Name</span>
                  </span>
                  Icon + name
                </Button>
                <Button
                  type="button"
                  aria-pressed={fullLogo}
                  onClick={() => header({ branding: "logo" })}
                >
                  <span className="logo-choice-wide" aria-hidden="true">
                    Logo
                  </span>
                  Full logo
                </Button>
              </div>
            </SettingsRow>
            {!fullLogo && (
              <SettingsRow label="Built-in icons">
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
                    <Button
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
                    </Button>
                  ))}
                </div>
              </SettingsRow>
            )}
            <SettingsRow label={fullLogo ? "Full logo" : "Custom icon"}>
              {fullLogo ? (
                <BrandImagePicker
                  title="Full logo"
                  kind="logo"
                  value={draft.dashboard.logo ?? ""}
                  triggerLabel={
                    draft.dashboard.logo ? "Edit logo image" : "Choose logo image"
                  }
                  hint="Rectangular artwork replaces the icon and name. PNG, JPEG or WebP, up to 8 MiB."
                  onBusy={onBusy}
                  onLive={(logo) => header({ logo })}
                />
              ) : (
                <BrandImagePicker
                  title="Custom icon"
                  kind="icon"
                  value={draft.dashboard.logo ?? ""}
                  triggerLabel={
                    draft.dashboard.logo ? "Edit custom image" : "Custom image"
                  }
                  hint="Square artwork beside the name. PNG, JPEG or WebP, up to 8 MiB."
                  onBusy={onBusy}
                  onLive={(logo) => header({ logo })}
                />
              )}
            </SettingsRow>
          </SettingsGroup>
        </Section>
        <Section level="h3" className="settings-section"
          title="Workspace"
          description="Tiles keep their size. Narrow screens use a read-only layout."
        >
          <SettingsGroup>
            <SettingsRow label="Dashboard width">
              <Select
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
            <SettingsRow>
              <IntegerField
                label={
                  draft.dashboard.widthMode === "full"
                    ? "Saved workspace width (px)"
                    : "Width (px)"
                }
                min={768}
                max={3840}
                value={draft.dashboard.width}
                onCommit={(width) => header({ width })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
        <Section level="h3" className="settings-section" title="Navigation">
          <SettingsGroup>
            <SwitchRow
              label="Show button labels"
              checked={a.showButtonLabels}
              onCheckedChange={(checked) =>
                appearance({ showButtonLabels: checked })
              }
            />
          </SettingsGroup>
        </Section>
      </>
    );

  if (section === "panes")
    return (
      <>
        <Section level="h3" className="settings-section"
          title="Pane finish"
          description={
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
            description="Tune frost and refraction. Displacement needs frost to bend what is behind the pane — below 6 px is raised automatically when displacement is on."
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
        <Section level="h3" className="settings-section" title="Labels" description="Show names beneath app icons.">
          <SettingsGroup>
            <SwitchRow
              label="Show app labels"
              checked={a.showAppLabels}
              onCheckedChange={(checked) => appearance({ showAppLabels: checked })}
            />
          </SettingsGroup>
        </Section>
      </>
    );

  if (section === "background")
    return (
      <BackgroundSettings
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
        description="Changing theme resets custom colours."
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
        description="Accent is used for buttons, selections and focus."
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
            <p className="hint">
              Text contrast is checked before saving. Check glass over images.
            </p>
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
        description="Bundled typefaces for the whole dashboard. Pane titles also use the size below."
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
