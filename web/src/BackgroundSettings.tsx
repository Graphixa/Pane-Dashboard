import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Play, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ColourField,
  ColourPopoverFields,
  IconButton,
  Modal,
  Popover,
  PopoverHead,
  ImagePopoverActions,
  Range,
  Select,
  SelectOption,
  ScrollArea,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
  Text,
  useConfirmation,
  useDeferredColour,
} from "./design/components";
import ImageField from "./ImageField";
import {
  accentPresets,
  defaultBackground,
  defaultOverlayColour,
  gradients,
  motionStyleLabels,
  motionStyles,
  overlayBackground,
  prependBackgroundImage,
  solidBackgroundPaint,
  withMotionStyle,
  type Background as BackgroundSettings,
  type MotionStyle,
  type OverlayMode,
} from "./appearance";
import { defaultDynamicParams } from "./dynamic/params";
import { getDynamicPack, listDynamicPacks } from "./dynamic/registry";
import type { DynamicControl, DynamicPack } from "./dynamic/types";

type BackgroundUpdate = (update: Partial<BackgroundSettings>) => void;

function titleCase(id: string) {
  return id[0].toUpperCase() + id.slice(1);
}

function defaultMotionFor(kind: BackgroundSettings["kind"]): MotionStyle {
  return kind === "image" ? "ken-burns" : "drift";
}

function ColourSwatch({
  label,
  colour,
  pressed = false,
  hueDefault = false,
  onSelect,
  onColour,
  paintLive,
}: {
  label: string;
  colour: string;
  pressed?: boolean;
  hueDefault?: boolean;
  onSelect?: () => void;
  onColour: (colour: string) => void;
  paintLive?: (colour: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { live, hex, setHex, noteInput, applyHex, flush } = useDeferredColour({
    colour,
    onColour,
    paintLive,
  });
  const close = () => {
    flush();
    setOpen(false);
  };
  const picking = open && live.toLowerCase() !== colour.toLowerCase();
  const hue = hueDefault && !picking;
  return (
    <Popover
      label={label}
      open={open}
      onOpenChange={(next) => {
        if (next) onSelect?.();
        else flush();
        setOpen(next);
      }}
      trigger={
        <Button
          variant="surface"
          aria-label={label}
          title={label}
          aria-pressed={pressed}
          className="colour-tile overlay-swatch overlay-custom"
        >
          <span className="overlay-swatch-frame">
            <span
              className={`colour-tile-paint${hue ? " overlay-custom-hue" : ""}`}
              style={hue ? undefined : { background: picking ? live : colour }}
              aria-hidden="true"
            />
            <span className="colour-tile-tick" aria-hidden="true">
              {pressed ? "✓" : ""}
            </span>
          </span>
        </Button>
      }
    >
      <PopoverHead title={label} closeLabel={`Close ${label} picker`} onClose={close} />
      <ColourPopoverFields
        pickerLabel={label}
        swatchValue={/^#[0-9a-f]{6}$/.test(live) ? live : colour}
        hex={hex}
        onHexChange={setHex}
        onSwatchChange={noteInput}
        onHexCommit={applyHex}
      />
    </Popover>
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
    <Button
      variant="surface"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`colour-tile overlay-swatch ${className}`}
      onClick={() => onSelect(id)}
    >
      <span className="overlay-swatch-frame">
        <span className="colour-tile-paint" aria-hidden="true" />
        <span className="colour-tile-tick" aria-hidden="true">
          {pressed ? "✓" : ""}
        </span>
      </span>
    </Button>
  );
}

function BackgroundCustomAdd({
  settings,
  onBusy,
  background,
  open,
  onOpenChange,
}: {
  settings: BackgroundSettings;
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const revert = useRef<Partial<BackgroundSettings> | null>(null);
  const beginEdit = () => {
    if (revert.current) return;
    revert.current = {
      kind: settings.kind,
      image: settings.image,
      images: [...(settings.images ?? [])],
      position: settings.position,
      motion: settings.motion,
      motionStyle: settings.motionStyle,
    };
    setDraft("");
  };
  useEffect(() => {
    if (open) beginEdit();
  }, [open]);
  const cancel = () => {
    if (busy) return;
    if (revert.current) background(revert.current);
    revert.current = null;
    setDraft("");
    onOpenChange(false);
  };
  const confirm = () => {
    if (busy) return;
    if (!draft) {
      cancel();
      return;
    }
    revert.current = null;
    setDraft("");
    onOpenChange(false);
  };
  return (
    <Popover
      label="Custom background image"
      size="image"
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          cancel();
          return;
        }
        beginEdit();
        onOpenChange(true);
      }}
      trigger={
        <Button
          variant="surface"
          type="button"
          className="background-swatch background-swatch-add"
          aria-label="Add photo"
          title="Add photo"
        >
          <div className="ui-aspect-ratio background-swatch-frame">
            <span className="background-swatch-add-placeholder" aria-hidden="true">
              <Plus size={22} />
            </span>
          </div>
        </Button>
      }
    >
      <PopoverHead
        title="Add image"
        closeLabel="Close custom image picker"
        disabled={busy}
        onClose={cancel}
      />
      <ImageField
        label="Background image"
        kind="background"
        value={draft}
        change={(image) => {
          setDraft(image);
          const library = revert.current?.images ?? settings.images ?? [];
          background({
            kind: "image",
            image,
            images: prependBackgroundImage(library, image),
          });
        }}
        onBusy={(v) => {
          setBusy(v);
          onBusy(v);
        }}
        hint="PNG, JPEG or WebP, up to 8 MiB. Newest uploads appear first."
      />
      <SettingsRow label="Image position">
        <Select
          value={settings.position}
          onValueChange={(value) =>
            background({
              position: value as BackgroundSettings["position"],
            })
          }
        >
          <SelectOption value="center">Centre</SelectOption>
          <SelectOption value="top">Top</SelectOption>
          <SelectOption value="bottom">Bottom</SelectOption>
        </Select>
      </SettingsRow>
      <ImagePopoverActions cancel={cancel} confirm={confirm} />
    </Popover>
  );
}

function BackgroundImageTile({
  image,
  index,
  pressed,
  onSelect,
  onRemove,
}: {
  image: string;
  index: number;
  pressed: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const label = `My image ${index + 1}`;
  return (
    <div className="background-swatch-wrap">
      <Button
        variant="surface"
        type="button"
        className="background-swatch"
        aria-label={label}
        title={label}
        aria-pressed={pressed}
        onClick={onSelect}
      >
        <div className="ui-aspect-ratio background-swatch-frame">
          <span
            className="background-swatch-paint background-current-image"
            style={{ backgroundImage: `url(${image})` }}
          />
        </div>
      </Button>
      <IconButton
        variant="quiet"
        type="button"
        className="background-swatch-remove"
        label={`Remove ${label}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function MyImagesTiles({
  b,
  onBusy,
  background,
  customOpen,
  onCustomOpenChange,
  onRemoveImage,
}: {
  b: BackgroundSettings;
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  customOpen: boolean;
  onCustomOpenChange: (open: boolean) => void;
  onRemoveImage: (image: string) => void;
}) {
  const library = b.images?.length ? b.images : b.image ? [b.image] : [];
  return (
    <>
      <BackgroundCustomAdd
        settings={b}
        onBusy={onBusy}
        background={background}
        open={customOpen}
        onOpenChange={onCustomOpenChange}
      />
      {library.map((image, index) => (
        <BackgroundImageTile
          key={`${index}-${image.slice(0, 48)}`}
          image={image}
          index={index}
          pressed={b.kind === "image" && b.image === image}
          onSelect={() => background({ kind: "image", image })}
          onRemove={() => onRemoveImage(image)}
        />
      ))}
    </>
  );
}

function solidColourName(
  colour: string,
  theme: "dark" | "light",
): string {
  const hex = colour.toLowerCase();
  return (
    accentPresets[theme].find((p) => p.colour.toLowerCase() === hex)?.name ??
    "Custom"
  );
}

function currentName(b: BackgroundSettings, theme: "dark" | "light") {
  if (b.kind === "none") return "None";
  if (b.kind === "solid") return solidColourName(b.colour, theme);
  if (b.kind === "gradient") return titleCase(b.preset);
  if (b.kind === "image") return "Custom";
  if (b.kind === "dynamic") {
    return listDynamicPacks().find((p) => p.id === b.dynamicId)?.name ?? "Dynamic";
  }
  return "Dynamic";
}

function StillPreview({ b }: { b: BackgroundSettings }) {
  let paint: ReactNode;
  if (b.kind === "none") {
    paint = <span className="background-swatch-paint" style={{ background: "var(--bg)" }} />;
  } else if (b.kind === "solid") {
    paint = (
      <span
        className="background-swatch-paint"
        style={{ background: solidBackgroundPaint(b.colour) }}
      />
    );
  } else if (b.kind === "image" && b.image) {
    paint = (
      <span
        className="background-swatch-paint background-current-image"
        style={{ backgroundImage: `url(${b.image})` }}
      />
    );
  } else if (b.kind === "dynamic") {
    const pack = listDynamicPacks().find((p) => p.id === b.dynamicId);
    paint = (
      <span
        className="swatch-mini-scene scene-dynamic-thumb"
        style={{ background: gradients[b.preset] }}
      >
        <span className="swatch-dynamic-label">{pack?.name ?? "Dynamic"}</span>
        <span className="swatch-play" aria-hidden="true">
          <Play size={12} fill="currentColor" />
        </span>
      </span>
    );
  } else {
    paint = (
      <span
        className="background-swatch-paint"
        style={{ background: gradients[b.preset] }}
      />
    );
  }
  return (
    <div className="background-current-preview">
      <div className="ui-aspect-ratio background-current-frame">{paint}</div>
    </div>
  );
}

function StillTile({
  label,
  pressed,
  paint,
  onSelect,
}: {
  label: string;
  pressed: boolean;
  paint: string;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="background-swatch"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <div className="ui-aspect-ratio background-swatch-frame">
        <span className="background-swatch-paint" style={{ background: paint }} />
      </div>
    </Button>
  );
}

function DynamicTile({
  pack,
  pressed,
  preset,
  onSelect,
}: {
  pack: DynamicPack;
  pressed: boolean;
  preset: BackgroundSettings["preset"];
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="background-swatch background-swatch-animated"
      aria-label={pack.name}
      title={pack.name}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <div className="ui-aspect-ratio background-swatch-frame">
        <span
          className="swatch-mini-scene scene-dynamic-thumb"
          style={{ background: gradients[preset] }}
        >
          <span className="swatch-dynamic-label">{pack.name}</span>
          <span className="swatch-play" aria-hidden="true">
            <Play size={12} fill="currentColor" />
          </span>
        </span>
      </div>
    </Button>
  );
}

function StillTiles({
  b,
  background,
}: {
  b: BackgroundSettings;
  background: BackgroundUpdate;
}) {
  return (
    <>
      <StillTile
        label="None"
        pressed={b.kind === "none"}
        paint="var(--bg)"
        onSelect={() => {
          background({ kind: "none" });
        }}
      />
      {Object.entries(gradients).map(([id, gradient]) => (
        <StillTile
          key={id}
          label={titleCase(id)}
          pressed={b.kind === "gradient" && b.preset === id}
          paint={gradient}
          onSelect={() => {
            background({
              kind: "gradient",
              preset: id as BackgroundSettings["preset"],
            });
          }}
        />
      ))}
    </>
  );
}

function DynamicTiles({
  b,
  background,
}: {
  b: BackgroundSettings;
  background: BackgroundUpdate;
}) {
  return (
    <>
      {listDynamicPacks().map((pack) => (
        <DynamicTile
          key={pack.id}
          pack={pack}
          pressed={b.kind === "dynamic" && b.dynamicId === pack.id}
          preset={b.preset}
          onSelect={() => {
            background({
              kind: "dynamic",
              dynamicId: pack.id,
              dynamicParams: defaultDynamicParams(pack),
              ...withMotionStyle("none"),
            });
          }}
        />
      ))}
    </>
  );
}

type CollectionId = "my-images" | "gradients" | "dynamic";

function wallpaperCollections(): {
  id: CollectionId;
  title: string;
  count: number;
}[] {
  return [
    { id: "my-images", title: "My images", count: 1 },
    { id: "gradients", title: "Gradients", count: 1 + Object.keys(gradients).length },
    { id: "dynamic", title: "Dynamic", count: listDynamicPacks().length },
  ];
}

/** Horizontal shelf: tiles sit in a settings-group inset and clip there. No chevrons or strip scrollbars. */
function WallpaperShelf({
  heading,
  label,
  compact = false,
  showAll,
  onShowAll,
  children,
}: {
  heading: string;
  label: string;
  compact?: boolean;
  showAll?: boolean;
  onShowAll?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`background-shelf${compact ? " background-shelf-compact" : ""}`}>
      <div className="background-shelf-head">
        <Text as="h3" variant="label" className="background-shelf-heading">
          {heading}
        </Text>
        {showAll && onShowAll && (
          <Button
            type="button"
            variant="quiet"
            className="background-shelf-show-all"
            aria-label={`Show all ${heading}`}
            onClick={onShowAll}
          >
            Show all
          </Button>
        )}
      </div>
      <SettingsGroup className="background-shelf-box">
        <div
          className="background-shelf-bleed"
          tabIndex={0}
          role="group"
          aria-label={label}
        >
          <div className="background-shelf-track">{children}</div>
        </div>
      </SettingsGroup>
    </section>
  );
}

/** Readable plus/check on a tint swatch. */
function chipInk(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#ffffff";
  const y = ((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114;
  return y > 160000 ? "#1a222e" : "#ffffff";
}

/** Scene tint only. Skips the Settings/dashboard render until the drag settles. */
function paintWallpaperTint(hex: string) {
  const paint = solidBackgroundPaint(hex);
  document.querySelectorAll<HTMLElement>("[data-wallpaper-tint]").forEach((node) => {
    node.style.background = paint;
  });
}

/** Scene overlay only. Same settle-then-commit path as the wallpaper tint. */
function paintOverlayColour(hex: string, opacity: number) {
  const paint = overlayBackground({
    ...defaultBackground,
    overlay: "custom",
    overlayColour: hex,
    overlayOpacity: opacity,
  });
  document.querySelectorAll<HTMLElement>(".scene-overlay").forEach((node) => {
    node.style.background = paint;
  });
}

function WallpaperColourChip({
  name,
  colour,
  pressed,
  onSelect,
}: {
  name: string;
  colour: string;
  pressed: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="wallpaper-colour-chip"
      aria-label={name}
      title={name}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <span
        className="wallpaper-colour-chip-paint"
        style={{ background: colour, color: chipInk(colour) }}
        aria-hidden="true"
      >
        {pressed ? <Check size={16} strokeWidth={2.75} /> : null}
      </span>
    </Button>
  );
}

function WallpaperCustomColour({
  colour,
  pressed,
  onColour,
}: {
  colour: string;
  pressed: boolean;
  onColour: (colour: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { live, hex, setHex, noteInput, applyHex, flush } = useDeferredColour({
    colour,
    onColour,
    paintLive: paintWallpaperTint,
  });
  const picking = open && live.toLowerCase() !== colour.toLowerCase();
  const filled = pressed || picking;
  return (
    <Popover
      label="Custom colour"
      open={open}
      onOpenChange={(next) => {
        if (!next) flush();
        setOpen(next);
      }}
      trigger={
        <Button
          variant="surface"
          type="button"
          className={`wallpaper-colour-chip wallpaper-colour-chip-add${picking ? " wallpaper-colour-chip-picking" : ""}${filled ? " wallpaper-colour-chip-filled" : ""}`}
          aria-label="Custom colour"
          title="Custom colour"
          aria-pressed={pressed}
        >
          <span
            className="wallpaper-colour-chip-paint"
            style={filled ? { background: live, color: chipInk(live) } : undefined}
            aria-hidden="true"
          >
            {pressed && !open ? (
              <Check size={16} strokeWidth={2.75} />
            ) : (
              <Plus size={16} />
            )}
          </span>
        </Button>
      }
    >
      <PopoverHead
        title="Custom colour"
        closeLabel="Close Custom colour picker"
        onClose={() => {
          flush();
          setOpen(false);
        }}
      />
      <ColourPopoverFields
        pickerLabel="Custom colour"
        swatchValue={/^#[0-9a-f]{6}$/.test(live) ? live : "#a2cbbb"}
        hex={hex}
        onHexChange={setHex}
        onSwatchChange={noteInput}
        onHexCommit={applyHex}
      />
    </Popover>
  );
}

function WallpaperColoursShelf({
  b,
  theme,
  background,
}: {
  b: BackgroundSettings;
  theme: "dark" | "light";
  background: BackgroundUpdate;
}) {
  const selected =
    b.kind === "solid" ? b.colour.toLowerCase() : "";
  const presetMatch = accentPresets[theme].some(
    (p) => p.colour.toLowerCase() === selected,
  );
  return (
    <WallpaperShelf heading="Colours" label="Colours" compact>
      <WallpaperCustomColour
        colour={b.colour}
        pressed={b.kind === "solid" && !presetMatch}
        onColour={(colour) => background({ kind: "solid", colour })}
      />
      {accentPresets[theme].map(({ name, colour }) => (
        <WallpaperColourChip
          key={colour}
          name={name}
          colour={colour}
          pressed={selected === colour.toLowerCase()}
          onSelect={() =>
            background({ kind: "solid", colour: colour.toLowerCase() })
          }
        />
      ))}
    </WallpaperShelf>
  );
}

function OverlaySettingsBody({
  b,
  theme,
  background,
}: {
  b: BackgroundSettings;
  theme: "dark" | "light";
  background: BackgroundUpdate;
}) {
  return (
    <>
      <Text as="p" variant="support">
        Improve contrast over the background. Theme changes keep solid or
        gradient unless Custom is selected.
      </Text>
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
                defaultOverlayColour(theme).toLowerCase()
              }
              onSelect={() => background({ overlay: "custom" })}
              paintLive={(hex) => paintOverlayColour(hex, b.overlayOpacity)}
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
    </>
  );
}

/** Scene CSS var only. Skips the Settings/dashboard render until the drag settles. */
function paintDynamicCssVar(cssVar: string, hex: string) {
  document.querySelectorAll<HTMLElement>(".scene-dynamic").forEach((node) => {
    node.style.setProperty(cssVar, hex);
  });
}

function DynamicControlFields({
  pack,
  params,
  onChange,
}: {
  pack: DynamicPack;
  params: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  return (
    <SettingsGroup>
      {pack.controls.map((control: DynamicControl) => {
        const value = params[control.key] ?? control.default;
        if (control.type === "range") {
          return (
            <Range
              key={control.key}
              label={control.label}
              value={typeof value === "number" ? value : control.default}
              min={control.min}
              max={control.max}
              unit={control.map === "duration" ? "" : ""}
              change={(n) => onChange(control.key, n)}
            />
          );
        }
        if (control.type === "toggle") {
          return (
            <SwitchRow
              key={control.key}
              label={control.label}
              checked={!!value}
              onCheckedChange={(checked) => onChange(control.key, checked)}
            />
          );
        }
        if (control.type === "select") {
          return (
            <SettingsRow key={control.key} label={control.label}>
              <Select
                aria-label={control.label}
                value={String(value)}
                onValueChange={(v) => onChange(control.key, v)}
              >
                {control.options.map((o) => (
                  <SelectOption key={o.value} value={o.value}>
                    {o.label}
                  </SelectOption>
                ))}
              </Select>
            </SettingsRow>
          );
        }
        const hex = typeof value === "string" ? value : String(control.default);
        return (
          <ColourField
            key={control.key}
            label={control.label}
            colour={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : "#a2cbbb"}
            onColour={(next) => onChange(control.key, next)}
            paintLive={(next) => paintDynamicCssVar(control.cssVar, next)}
          />
        );
      })}
    </SettingsGroup>
  );
}

export default function BackgroundSettings({
  settings: b,
  theme,
  onBusy,
  background,
  onPreviewAdjust,
}: {
  settings: BackgroundSettings;
  theme: "dark" | "light";
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  onPreviewAdjust?: (active: boolean) => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [collection, setCollection] = useState<CollectionId | null>(null);
  const [motionOpen, setMotionOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [dynamicOpen, setDynamicOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const librarySnapshot = useRef<BackgroundSettings | null>(null);
  const lastMotion = useRef<MotionStyle>(
    b.motionStyle !== "none" ? b.motionStyle : defaultMotionFor(b.kind),
  );
  const lastOverlayOpacity = useRef(
    b.overlayOpacity > 0 ? b.overlayOpacity : 25,
  );
  useEffect(() => {
    if (b.motionStyle !== "none") lastMotion.current = b.motionStyle;
  }, [b.motionStyle]);
  useEffect(() => {
    if (b.overlayOpacity > 0) lastOverlayOpacity.current = b.overlayOpacity;
  }, [b.overlayOpacity]);
  useEffect(() => {
    onPreviewAdjust?.(motionOpen || overlayOpen || libraryOpen || dynamicOpen);
    return () => onPreviewAdjust?.(false);
  }, [motionOpen, overlayOpen, libraryOpen, dynamicOpen, onPreviewAdjust]);

  const motionOn = b.motionStyle !== "none";
  const overlayOn = b.overlayOpacity > 0;
  const canAdjust = b.kind !== "none";
  const showImageMotion = b.kind === "image";
  const dynamicPack =
    b.kind === "dynamic" && b.dynamicId ? getDynamicPack(b.dynamicId) : undefined;
  const closeMotion = () => setMotionOpen(false);
  const closeOverlay = () => setOverlayOpen(false);
  const closeDynamic = () => setDynamicOpen(false);
  const snapshotBackground = (value: BackgroundSettings): BackgroundSettings => ({
    ...value,
    images: [...(value.images ?? [])],
  });
  const openLibrary = () => {
    librarySnapshot.current = snapshotBackground(b);
    setCollection(null);
    setCustomOpen(false);
    setLibraryOpen(true);
  };
  const finishLibrary = () => {
    setCollection(null);
    setCustomOpen(false);
    setLibraryOpen(false);
  };
  /** Keep the live preview and close the sheet. */
  const commitLibrary = () => {
    librarySnapshot.current = null;
    finishLibrary();
  };
  /** X / Escape: restore the snapshot taken on open. */
  const discardLibrary = () => {
    const snap = librarySnapshot.current;
    librarySnapshot.current = null;
    if (snap) background(snap);
    finishLibrary();
  };
  const backToFolders = () => {
    setCustomOpen(false);
    setCollection(null);
  };
  const removeLibraryImage = async (image: string) => {
    const ok = await confirm({
      title: "Remove image?",
      description: "Remove this image from My images? This cannot be undone from here.",
      cancelLabel: "Keep",
      actionLabel: "Remove",
      actionVariant: "danger",
    });
    if (!ok) return;
    const next = (b.images ?? []).filter((entry) => entry !== image);
    if (b.image === image) {
      if (next[0]) background({ images: next, image: next[0], kind: "image" });
      else background({ images: next, image: "", kind: "none" });
      return;
    }
    background({ images: next });
  };
  const setMotionEnabled = (checked: boolean) => {
    if (checked) {
      const style =
        lastMotion.current === "none"
          ? defaultMotionFor(b.kind)
          : lastMotion.current;
      background(withMotionStyle(style));
    } else {
      setMotionOpen(false);
      background(withMotionStyle("none"));
    }
  };
  const setOverlayEnabled = (checked: boolean) => {
    if (checked) {
      background({
        overlayOpacity: lastOverlayOpacity.current || 25,
      });
    } else {
      setOverlayOpen(false);
      background({ overlayOpacity: 0 });
    }
  };
  const collectionTitle =
    wallpaperCollections().find((item) => item.id === collection)?.title ??
    "Choose wallpaper";

  return (
    <>
      {confirmation}
      <SettingsGroup className="background-current-group">
        <SettingsRow>
          <div className="background-current">
            <StillPreview b={b} />
            <div className="background-current-meta">
              <Text as="span" variant="support" className="background-current-eyebrow">
                Currently set
              </Text>
              <Text as="span" variant="label" className="background-current-name">
                {currentName(b, theme)}
              </Text>
              <Button
                type="button"
                className="background-current-change"
                onClick={openLibrary}
              >
                Change wallpaper
              </Button>
            </div>
          </div>
        </SettingsRow>
        {b.kind === "image" && (
          <SettingsRow label="Image position">
            <Select
              aria-label="Image position"
              value={b.position}
              onValueChange={(value) =>
                background({
                  position: value as BackgroundSettings["position"],
                })
              }
            >
              <SelectOption value="center">Centre</SelectOption>
              <SelectOption value="top">Top</SelectOption>
              <SelectOption value="bottom">Bottom</SelectOption>
            </Select>
          </SettingsRow>
        )}
        {dynamicPack && (
          <SettingsRow label="Dynamic effect">
            <Button
              type="button"
              variant="quiet"
              className="background-effect-customize"
              aria-label="Customize dynamic effect"
              onClick={() => setDynamicOpen(true)}
            >
              Customize
            </Button>
          </SettingsRow>
        )}
        {canAdjust && (
          <>
            {showImageMotion && (
              <SwitchRow
                label="Motion effects"
                checked={motionOn}
                onCheckedChange={setMotionEnabled}
                action={
                  <Button
                    type="button"
                    variant="quiet"
                    className="background-effect-customize"
                    aria-label="Customize motion"
                    disabled={!motionOn}
                    onClick={() => setMotionOpen(true)}
                  >
                    Customize
                  </Button>
                }
              />
            )}
            <SwitchRow
              label="Wallpaper overlay"
              checked={overlayOn}
              onCheckedChange={setOverlayEnabled}
              action={
                <Button
                  type="button"
                  variant="quiet"
                  className="background-effect-customize"
                  aria-label="Customize overlay"
                  disabled={!overlayOn}
                  onClick={() => setOverlayOpen(true)}
                >
                  Customize
                </Button>
              }
            />
          </>
        )}
      </SettingsGroup>

      {libraryOpen && (
        <Modal
          nested
          placement="bottom"
          backdrop="none"
          title={collection ? collectionTitle : "Choose wallpaper"}
          close={discardLibrary}
          className="background-library-dialog"
        >
          <ScrollArea
            className="background-library-body-scroll"
            type="auto"
            aria-label={collection ? collectionTitle : "Wallpaper shelves"}
          >
            {collection ? (
              <div className="background-library-grid">
                {collection === "my-images" && (
                  <MyImagesTiles
                    b={b}
                    onBusy={onBusy}
                    background={background}
                    customOpen={customOpen}
                    onCustomOpenChange={setCustomOpen}
                    onRemoveImage={removeLibraryImage}
                  />
                )}
                {collection === "gradients" && (
                  <StillTiles b={b} background={background} />
                )}
                {collection === "dynamic" && (
                  <DynamicTiles b={b} background={background} />
                )}
              </div>
            ) : (
              <div className="background-library-shelves">
                <WallpaperColoursShelf
                  b={b}
                  theme={theme}
                  background={background}
                />
                <WallpaperShelf
                  heading="My images"
                  label="My images"
                  showAll
                  onShowAll={() => setCollection("my-images")}
                >
                  <MyImagesTiles
                    b={b}
                    onBusy={onBusy}
                    background={background}
                    customOpen={customOpen}
                    onCustomOpenChange={setCustomOpen}
                    onRemoveImage={removeLibraryImage}
                  />
                </WallpaperShelf>
                <WallpaperShelf
                  heading="Gradients"
                  label="Gradients"
                  showAll
                  onShowAll={() => setCollection("gradients")}
                >
                  <StillTiles b={b} background={background} />
                </WallpaperShelf>
                <WallpaperShelf
                  heading="Dynamic"
                  label="Dynamic"
                  showAll
                  onShowAll={() => setCollection("dynamic")}
                >
                  <DynamicTiles b={b} background={background} />
                </WallpaperShelf>
              </div>
            )}
          </ScrollArea>
          <div className="ui-actions background-library-actions">
            {collection ? (
              <Button type="button" variant="secondary" onClick={backToFolders}>
                Back
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={commitLibrary}>
              Select
            </Button>
          </div>
        </Modal>
      )}

      {motionOpen && (
        <Modal
          nested
          placement="bottom"
          backdrop="none"
          title="Motion settings"
          close={closeMotion}
          className="background-adjust-dialog"
        >
          <SettingsGroup>
            <SettingsRow label="Motion style">
              <Select
                aria-label="Motion style"
                value={b.motionStyle}
                onValueChange={(value) => {
                  const style = value as MotionStyle;
                  if (style === b.motionStyle) return;
                  background(withMotionStyle(style));
                }}
              >
                {motionStyles
                  .filter((id) => id !== "none")
                  .map((id) => (
                    <SelectOption key={id} value={id}>
                      {motionStyleLabels[id]}
                    </SelectOption>
                  ))}
              </Select>
            </SettingsRow>
            <Range
              label="Speed"
              value={b.intensity}
              min={0}
              max={100}
              unit="%"
              change={(intensity) => background({ intensity })}
            />
          </SettingsGroup>
          <div className="ui-actions">
            <Button variant="primary" onClick={closeMotion}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {overlayOpen && (
        <Modal
          nested
          placement="bottom"
          backdrop="none"
          title="Overlay settings"
          close={closeOverlay}
          className="background-adjust-dialog"
        >
          <OverlaySettingsBody b={b} theme={theme} background={background} />
          <div className="ui-actions">
            <Button variant="primary" onClick={closeOverlay}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {dynamicOpen && dynamicPack && (
        <Modal
          nested
          placement="bottom"
          backdrop="none"
          title={`${dynamicPack.name} settings`}
          close={closeDynamic}
          className="background-adjust-dialog"
        >
          <DynamicControlFields
            pack={dynamicPack}
            params={b.dynamicParams ?? {}}
            onChange={(key, value) =>
              background({
                dynamicParams: { ...(b.dynamicParams ?? {}), [key]: value },
              })
            }
          />
          <div className="ui-actions">
            <Button variant="primary" onClick={closeDynamic}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
