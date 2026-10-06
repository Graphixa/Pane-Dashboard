import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play, Plus, Trash2, X } from "lucide-react";
import {
  AspectRatio,
  Button,
  IconButton,
  Input,
  Label,
  Modal,
  Popover,
  Range,
  ScrollArea,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
  Text,
  useConfirmation,
} from "./design/components";
import ImageField from "./ImageField";
import {
  accentPresets,
  defaultOverlayColour,
  gradients,
  motionStyleLabels,
  motionStyles,
  prependBackgroundImage,
  solidBackgroundPaint,
  withMotionStyle,
  type Background as BackgroundSettings,
  type MotionStyle,
  type OverlayMode,
} from "./appearance";

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
}: {
  label: string;
  colour: string;
  pressed?: boolean;
  hueDefault?: boolean;
  onSelect?: () => void;
  onColour: (colour: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [hex, setHex] = useState(colour);
  useEffect(() => setHex(colour), [colour]);
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
  return (
    <Popover
      label={label}
      open={open}
      onOpenChange={(next) => {
        if (next) onSelect?.();
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
              className={`colour-tile-paint${hueDefault ? " overlay-custom-hue" : ""}`}
              style={hueDefault ? undefined : { background: colour }}
              aria-hidden="true"
            />
            <span className="colour-tile-tick" aria-hidden="true">
              {pressed ? "✓" : ""}
            </span>
          </span>
        </Button>
      }
    >
      <div className="colour-popover-head">
        <Text as="span" variant="label">
          {label}
        </Text>
        <IconButton
          variant="quiet"
          label={`Close ${label} picker`}
          onClick={() => setOpen(false)}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="colour-popover-body">
        <Label className="colour-popover-swatch">
          <Input
            type="color"
            aria-label={`Pick ${label}`}
            value={colour}
            onChange={(e) => {
              onSelect?.();
              onColour(e.target.value);
              setHex(e.target.value);
            }}
          />
        </Label>
        <Label className="colour-popover-hex">
          <span>Hex</span>
          <Input
            spellCheck={false}
            maxLength={7}
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyHex(e.currentTarget.value);
              }
            }}
          />
        </Label>
      </div>
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

function ImagePopoverActions({
  cancel,
  confirm,
}: {
  cancel: () => void;
  confirm: () => void;
}) {
  return (
    <div className="ui-actions">
      <Button onClick={cancel}>Cancel</Button>
      <Button variant="primary" onClick={confirm}>
        OK
      </Button>
    </div>
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
          <AspectRatio className="background-swatch-frame">
            <span className="background-swatch-add-placeholder" aria-hidden="true">
              <Plus size={22} />
            </span>
          </AspectRatio>
        </Button>
      }
    >
      <div className="colour-popover-head">
        <Text as="span" variant="label">
          Add image
        </Text>
        <IconButton
          variant="quiet"
          label="Close custom image picker"
          disabled={busy}
          onClick={cancel}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
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
      <Label className="settings-row">
        <span>Image position</span>
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
      </Label>
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
        <AspectRatio className="background-swatch-frame">
          <span
            className="background-swatch-paint background-current-image"
            style={{ backgroundImage: `url(${image})` }}
          />
        </AspectRatio>
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
  if (b.kind === "waves") return "Waves";
  return "Aurora";
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
  } else if (b.kind === "waves" || b.kind === "aurora") {
    paint = (
      <span
        className={`swatch-mini-scene scene-${b.kind}`}
        style={{ background: gradients[b.preset] }}
      >
        <span className="scene-motion" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
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
      <AspectRatio className="background-current-frame">{paint}</AspectRatio>
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
      <AspectRatio className="background-swatch-frame">
        <span className="background-swatch-paint" style={{ background: paint }} />
      </AspectRatio>
    </Button>
  );
}

function AnimatedTile({
  kind,
  label,
  pressed,
  preset,
  onSelect,
}: {
  kind: "waves" | "aurora";
  label: string;
  pressed: boolean;
  preset: BackgroundSettings["preset"];
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="background-swatch background-swatch-animated"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <AspectRatio className="background-swatch-frame">
        <span
          className={`swatch-mini-scene scene-${kind}`}
          style={{ background: gradients[preset] }}
        >
          <span className="scene-motion" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="swatch-play" aria-hidden="true">
            <Play size={12} fill="currentColor" />
          </span>
        </span>
      </AspectRatio>
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

function AnimatedTiles({
  b,
  background,
}: {
  b: BackgroundSettings;
  background: BackgroundUpdate;
}) {
  return (
    <>
      {(["waves", "aurora"] as const).map((kind) => (
        <AnimatedTile
          key={kind}
          kind={kind}
          label={kind === "waves" ? "Waves" : "Aurora"}
          pressed={b.kind === kind}
          preset={b.preset}
          onSelect={() => {
            background({
              kind,
              ...(b.motionStyle === "none" ? withMotionStyle("drift") : {}),
            });
          }}
        />
      ))}
    </>
  );
}

type CollectionId = "my-images" | "gradients" | "dynamic";

const COLLECTIONS: {
  id: CollectionId;
  title: string;
  count: number;
}[] = [
  { id: "my-images", title: "My images", count: 1 },
  { id: "gradients", title: "Gradients", count: 1 + Object.keys(gradients).length },
  { id: "dynamic", title: "Dynamic", count: 2 },
];

/** Horizontal shelf: edge-bleed scroll, no chevrons or strip scrollbars. */
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
      <div
        className="background-shelf-bleed"
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        <div className="background-shelf-track">{children}</div>
      </div>
    </section>
  );
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
        style={{ background: colour }}
        aria-hidden="true"
      />
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
  const [hex, setHex] = useState(colour);
  useEffect(() => setHex(colour), [colour]);
  const applyHex = (value: string) => {
    const next = value.startsWith("#") ? value : `#${value}`;
    if (!/^#[a-fA-F0-9]{6}$/.test(next)) {
      setHex(colour);
      return;
    }
    const normalised = next.toLowerCase();
    setHex(normalised);
    onColour(normalised);
  };
  return (
    <Popover
      label="Custom colour"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="surface"
          type="button"
          className="wallpaper-colour-chip wallpaper-colour-chip-add"
          aria-label="Custom colour"
          title="Custom colour"
          aria-pressed={pressed}
        >
          <span className="wallpaper-colour-chip-paint" aria-hidden="true">
            <Plus size={18} />
          </span>
        </Button>
      }
    >
      <div className="colour-popover-head">
        <Text as="span" variant="label">
          Custom colour
        </Text>
        <IconButton
          variant="quiet"
          label="Close Custom colour picker"
          onClick={() => setOpen(false)}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="colour-popover-body">
        <Label className="colour-popover-swatch">
          <Input
            type="color"
            aria-label="Pick Custom colour"
            value={/^#[a-fA-F0-9]{6}$/.test(colour) ? colour : "#a2cbbb"}
            onChange={(e) => {
              onColour(e.target.value.toLowerCase());
              setHex(e.target.value);
            }}
          />
        </Label>
        <Label className="colour-popover-hex">
          <span>Hex</span>
          <Input
            spellCheck={false}
            maxLength={7}
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyHex(e.currentTarget.value);
              }
            }}
          />
        </Label>
      </div>
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
  const [customOpen, setCustomOpen] = useState(false);
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
    onPreviewAdjust?.(motionOpen || overlayOpen || libraryOpen);
    return () => onPreviewAdjust?.(false);
  }, [motionOpen, overlayOpen, libraryOpen, onPreviewAdjust]);

  const motionOn = b.motionStyle !== "none";
  const overlayOn = b.overlayOpacity > 0;
  const canAdjust = b.kind !== "none";
  const closeMotion = () => setMotionOpen(false);
  const closeOverlay = () => setOverlayOpen(false);
  const closeLibrary = () => {
    setCollection(null);
    setCustomOpen(false);
    setLibraryOpen(false);
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
    COLLECTIONS.find((item) => item.id === collection)?.title ?? "Choose wallpaper";

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
                onClick={() => setLibraryOpen(true)}
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
        {(b.kind === "waves" || b.kind === "aurora") && (
          <SettingsRow label="Animation palette">
            <Select
              aria-label="Animation palette"
              value={b.preset}
              onValueChange={(value) =>
                background({
                  preset: value as BackgroundSettings["preset"],
                })
              }
            >
              {Object.keys(gradients).map((k) => (
                <SelectOption key={k} value={k}>
                  {titleCase(k)}
                </SelectOption>
              ))}
            </Select>
          </SettingsRow>
        )}
        {canAdjust && (
          <>
            <SwitchRow
              label="Motion effects"
              checked={motionOn}
              onCheckedChange={setMotionEnabled}
              action={
                <Button
                  type="button"
                  variant="quiet"
                  className="background-effect-customize"
                  disabled={!motionOn}
                  onClick={() => setMotionOpen(true)}
                >
                  Customize
                </Button>
              }
            />
            <SwitchRow
              label="Wallpaper overlay"
              checked={overlayOn}
              onCheckedChange={setOverlayEnabled}
              action={
                <Button
                  type="button"
                  variant="quiet"
                  className="background-effect-customize"
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
          close={closeLibrary}
          className="background-library-dialog"
        >
          {collection ? (
            <>
              <ScrollArea
                orientation="vertical"
                type="scroll"
                className="background-library-body-scroll"
                aria-label={collectionTitle}
              >
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
                    <AnimatedTiles b={b} background={background} />
                  )}
                </div>
              </ScrollArea>
              <div className="ui-actions background-library-actions">
                <Button type="button" variant="secondary" onClick={backToFolders}>
                  Back
                </Button>
                <Button type="button" variant="primary" onClick={closeLibrary}>
                  Select
                </Button>
              </div>
            </>
          ) : (
            <ScrollArea
              orientation="vertical"
              type="scroll"
              className="background-library-body-scroll"
              aria-label="Wallpaper shelves"
            >
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
                  <AnimatedTiles b={b} background={background} />
                </WallpaperShelf>
              </div>
            </ScrollArea>
          )}
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
    </>
  );
}
