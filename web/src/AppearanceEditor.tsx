import { Button, Label, Input, Select, SelectOption, Popover, IconButton, Text, Section, Range, Disclosure, Notice, TextField, SelectField, SwitchRow } from "./design/components";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Server, LayoutGrid, PanelsTopLeft, ImagePlus, X } from "lucide-react";
import type { Config } from "./model";
import {
  contrast,
  defaultBackground,
  defaultGlass,
  defaultOverlayColour,
  gradients,
  migrateBackground,
  motionStyleLabels,
  motionStyles,
  normaliseGlass,
  overlayForTheme,
  accentPresets,
  parseIntegerInput,
  paletteForThemeChange,
  palettes,
  resolveUiFont,
  uiFontFamily,
  uiFonts,
  withMotionStyle,
  type Background as BackgroundSettings,
  type MotionStyle,
  type OverlayMode,
  type UiFont,
} from "./appearance";
import ImageField from "./ImageField";

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
    <Button variant="surface"
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
    </Button>
  );
}

function ColourSwatch({label, colour, pressed = false, hueDefault = false, onSelect, onColour}: {
  label: string; colour: string; pressed?: boolean; hueDefault?: boolean; onSelect?: () => void; onColour: (colour: string) => void;
}) {
  const [open, setOpen] = useState(false), [hex, setHex] = useState(colour);
  useEffect(() => setHex(colour), [colour]);
  const applyHex = (value: string) => {
    const next = value.startsWith('#') ? value : `#${value}`;
    if (!/^#[a-fA-F0-9]{6}$/.test(next)) {setHex(colour); return;}
    setHex(next); onSelect?.(); onColour(next.toLowerCase());
  };
  return <Popover label={label} open={open} onOpenChange={next => {if(next) onSelect?.(); setOpen(next);}} trigger={
    <Button variant="surface" aria-label={label} title={label} aria-pressed={pressed} className="colour-tile overlay-swatch overlay-custom">
      <span className={`colour-tile-paint${hueDefault ? ' overlay-custom-hue' : ''}`} style={hueDefault ? undefined : {background: colour}} aria-hidden="true" />
      <span className="colour-tile-tick" aria-hidden="true">{pressed ? '✓' : ''}</span>
    </Button>
  }>
    <div className="colour-popover-head"><Text as="span" variant="label">{label}</Text><IconButton variant="quiet" label={`Close ${label} picker`} onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></IconButton></div>
    <div className="colour-popover-body">
      <Label className="colour-popover-swatch"><Input type="color" aria-label={`Pick ${label}`} value={colour} onChange={e => {onSelect?.(); onColour(e.target.value); setHex(e.target.value);}} /></Label>
      <Label className="colour-popover-hex"><span>Hex</span><Input spellCheck={false} maxLength={7} value={hex} onChange={e => setHex(e.target.value)} onBlur={e => applyHex(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') {e.preventDefault(); applyHex(e.currentTarget.value);}}} /></Label>
    </div>
  </Popover>;
}
function ImagePopoverActions({cancel, confirm}: {cancel: () => void; confirm: () => void}) {
  return <div className="ui-actions"><Button onClick={cancel}>Cancel</Button><Button variant="primary" onClick={confirm}>OK</Button></div>;
}
function BrandImagePicker({title, kind, value, hint, triggerLabel, onBusy, onLive}: {
  title: string; kind: 'icon' | 'logo'; value: string; hint: string; triggerLabel: string; onBusy: (busy: boolean) => void; onLive: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), revert = useRef(value);
  const cancel = () => {if(busy) return; onLive(revert.current); setOpen(false);};
  return <Popover label={title} size="image" open={open} onOpenChange={next => {if(next) {revert.current = value; setOpen(true);} else cancel();}} trigger={<Button><ImagePlus size={16} aria-hidden="true" />{triggerLabel}</Button>}>
    <div className="colour-popover-head"><Text as="span" variant="label">{title}</Text><IconButton variant="quiet" label={`Close ${title.toLowerCase()} picker`} disabled={busy} onClick={cancel}><X size={16} aria-hidden="true" /></IconButton></div>
    <ImageField label="Logo image" kind={kind} value={value} change={onLive} onBusy={v => {setBusy(v); onBusy(v);}} hint={hint} />
    <ImagePopoverActions cancel={cancel} confirm={() => {if(!busy) setOpen(false);}} />
  </Popover>;
}
function BackgroundCustomSwatch({settings, onBusy, background}: {settings: BackgroundSettings; onBusy: (busy: boolean) => void; background: (update: Partial<BackgroundSettings>) => void}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const revert = useRef<Partial<BackgroundSettings> | null>(null);
  const cancel = () => {if(busy) return; if(revert.current) background(revert.current); revert.current = null; setOpen(false);};
  const confirm = () => {if(busy) return; if(!settings.image) background({kind: 'none', image: ''}); revert.current = null; setOpen(false);};
  return <Popover label="Custom background image" size="image" open={open} onOpenChange={next => {
    if(!next) {cancel(); return;}
    revert.current = {kind: settings.kind, image: settings.image, position: settings.position, motion: settings.motion, motionStyle: settings.motionStyle};
    // Keep the current motion style when returning to a saved custom image.
    if(settings.kind !== 'image') background({kind: 'image'}); setOpen(true);
  }} trigger={<Button variant="surface" className="background-swatch" aria-pressed={settings.kind === 'image'}><span className={`swatch-custom ${settings.image ? 'swatch-custom-set' : 'swatch-custom-empty'}`}><ImagePlus size={18} aria-hidden="true" /></span>Custom</Button>}>
    <div className="colour-popover-head"><Text as="span" variant="label">Custom image</Text><IconButton variant="quiet" label="Close custom image picker" disabled={busy} onClick={cancel}><X size={16} aria-hidden="true" /></IconButton></div>
    <ImageField label="Background image" kind="background" value={settings.image} change={image => background({image, kind: 'image'})} onBusy={v => {setBusy(v); onBusy(v);}} hint="PNG, JPEG or WebP, up to 8 MiB." />
    <Label className="settings-row"><span>Image position</span><Select value={settings.position} onValueChange={value => background({position: value as BackgroundSettings['position']})}><SelectOption value="center">Centre</SelectOption><SelectOption value="top">Top</SelectOption><SelectOption value="bottom">Bottom</SelectOption></Select></Label>
    <ImagePopoverActions cancel={cancel} confirm={confirm} />
  </Popover>;
}

export default function AppearanceEditor({
  draft,
  change,
  onBusy,
  section,
}: {
  section: "general" | "appearance" | "background" | "panes";
  draft: Config;
  change: (c: Config | ((prev: Config) => Config)) => void;
  onBusy: (b: boolean) => void;
}) {
  const accentHeadingId = useId();
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
  const background = (update: Partial<BackgroundSettings>) =>
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
          <TextField
            label="Dashboard name"
            maxLength={100}
            value={draft.dashboard.title}
            onChange={(e) => header({ title: e.target.value })}
          />
        </Section>
        <Section level="h3" className="settings-section"
          title="Logo"
          description="How your name and artwork appear in the header."
        >
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
          {!fullLogo && (
            <div className="settings-subsection">
              <Text as="h4" variant="label">Built-in icons</Text>
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
            </div>
          )}
          {fullLogo && (
            <div className="settings-subsection">
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
            </div>
          )}
        </Section>
        <Section level="h3" className="settings-section"
          title="Workspace"
          description="Tiles keep their size. Narrow screens use a read-only layout."
        >
          <div className="fields">
            <SelectField
              label="Dashboard width"
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
            </SelectField>
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
          </div>
        </Section>
        <Section level="h3" className="settings-section" title="Navigation">
          <SwitchRow
            label="Show button labels"
            checked={a.showButtonLabels}
            onCheckedChange={(checked) =>
              appearance({ showButtonLabels: checked })
            }
          />
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
            <div className="settings-control-group">
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
                min={100}
                max={200}
                unit="%"
                change={(saturation) => setGlass({ saturation })}
              />
              <Range
                label="Displacement"
                value={g.displacement}
                min={0}
                max={150}
                change={(displacement) => setGlass({ displacement })}
              />
              <Range
                label="Chromatic aberration"
                value={g.aberration}
                min={0}
                max={5}
                change={(aberration) => setGlass({ aberration })}
              />
              <Range
                label="Elasticity"
                value={g.elasticity}
                min={0}
                max={100}
                unit="%"
                change={(elasticity) => setGlass({ elasticity })}
              />
            </div>
          </Section>
        )}
        <Section level="h3" className="settings-section" title="Labels" description="Show names beneath app icons.">
          <SwitchRow
            label="Show app labels"
            checked={a.showAppLabels}
            onCheckedChange={(checked) => appearance({ showAppLabels: checked })}
          />
        </Section>
      </>
    );

  if (section === "background")
    return (
      <>
        <Section level="h3" className="settings-section"
          title="Static"
          description="Solid colour, gradients, or your own image."
        >
          <div
            className="background-gallery"
            role="group"
            aria-label="Static backgrounds"
          >
            <Button variant="surface"
              type="button"
              className="background-swatch"
              aria-pressed={b.kind === "none"}
              onClick={() => background({ kind: "none" })}
            >
              <span style={{ background: "var(--bg)" }} />
              None
            </Button>
            {Object.entries(gradients).map(([id, gradient]) => (
              <Button variant="surface"
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
              </Button>
            ))}
            <BackgroundCustomSwatch
              settings={b}
              onBusy={onBusy}
              background={background}
            />
          </div>
        </Section>
        <Section level="h3" className="settings-section"
          title="Animated"
          description="Motion backgrounds. Improvements are still underway."
        >
          <div
            className="background-gallery"
            role="group"
            aria-label="Animated backgrounds"
          >
            {(["waves", "aurora"] as const).map((kind) => (
              <Button variant="surface"
                type="button"
                className="background-swatch"
                key={kind}
                aria-pressed={b.kind === kind}
                onClick={() =>
                  background({
                    kind,
                    ...(b.motionStyle === "none"
                      ? withMotionStyle("drift")
                      : {}),
                  })
                }
              >
                <span
                  className={`swatch-${kind}`}
                  style={{ background: gradients[b.preset] }}
                />
                {kind === "waves" ? "Waves" : "Aurora"}
              </Button>
            ))}
          </div>
          {(b.kind === "waves" || b.kind === "aurora") && (
            <div className="settings-subsection">
              <Label className="settings-row">
                <span>Animation palette</span>
                <Select
                  value={b.preset}
                  onValueChange={(value) =>
                    background({
                      preset: value as BackgroundSettings["preset"],
                    })
                  }
                >
                  {Object.keys(gradients).map((k) => (
                    <SelectOption key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </SelectOption>
                  ))}
                </Select>
              </Label>
            </div>
          )}
        </Section>
        {b.kind !== "none" && (
          <Section level="h3" className="settings-section"
            title="Motion"
            description="Optional movement for the whole background. Try each style; keep None for a still scene."
          >
            <Label className="settings-row">
              <span>Motion style</span>
              <Select
                value={b.motionStyle}
                onValueChange={(value) => {
                  const style = value as MotionStyle;
                  if (style === b.motionStyle) return;
                  background(withMotionStyle(style));
                }}
              >
                {motionStyles.map((id) => (
                  <SelectOption key={id} value={id}>
                    {motionStyleLabels[id]}
                  </SelectOption>
                ))}
              </Select>
            </Label>
            {b.motionStyle !== "none" && (
              <Range
                label="Speed"
                value={b.intensity}
                min={0}
                max={100}
                unit="%"
                change={(intensity) => background({ intensity })}
              />
            )}
          </Section>
        )}
        {b.kind !== "none" && (
          <Section level="h3" className="settings-section"
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
        <h4 className="overlay-group-label" id={accentHeadingId}>
          Accent
        </h4>
        <div
          className="accent-swatches"
          role="group"
          aria-labelledby={accentHeadingId}
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
          <Notice tone="error">
            Increase text contrast before applying.
          </Notice>
        )}
        <Button variant="surface"
          type="button"
          className="text-button"
          disabled={!a.palette}
          onClick={() => appearance({ palette: undefined })}
        >
          Reset colours
        </Button>
      </Section>
      <Section level="h3" className="settings-section"
        title="Typography"
        description="Bundled typefaces for the whole dashboard. Pane titles also use the size below."
      >
        <SelectField
          label="Font"
          value={resolveUiFont(a.fontFamily)}
          style={{ fontFamily: uiFontFamily(resolveUiFont(a.fontFamily)) }}
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
        </SelectField>
        <IntegerField
          label="Pane title size (px)"
          min={14}
          max={22}
          value={a.paneTitleSize ?? 18}
          onCommit={(paneTitleSize) => appearance({ paneTitleSize })}
        />
      </Section>
    </>
  );
}
