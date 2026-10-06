import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Play, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  AspectRatio,
  Button,
  IconButton,
  Input,
  Label,
  Modal,
  Popover,
  Range,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
  Text,
} from "./design/components";
import ImageField from "./ImageField";
import {
  defaultOverlayColour,
  gradients,
  motionStyleLabels,
  motionStyles,
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
  onConfirmed,
}: {
  settings: BackgroundSettings;
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const revert = useRef<Partial<BackgroundSettings> | null>(null);
  const beginEdit = () => {
    if (revert.current) return;
    revert.current = {
      kind: settings.kind,
      image: settings.image,
      position: settings.position,
      motion: settings.motion,
      motionStyle: settings.motionStyle,
    };
    if (settings.kind !== "image") background({ kind: "image" });
  };
  useEffect(() => {
    if (open) beginEdit();
  }, [open]);
  const cancel = () => {
    if (busy) return;
    if (revert.current) background(revert.current);
    revert.current = null;
    onOpenChange(false);
  };
  const confirm = () => {
    if (busy) return;
    if (!settings.image) background({ kind: "none", image: "" });
    revert.current = null;
    onOpenChange(false);
    if (settings.image) onConfirmed?.();
  };
  const hasImage = !!settings.image;
  const selected = settings.kind === "image" && hasImage;
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
          className="background-swatch"
          aria-pressed={selected}
          aria-label={hasImage ? "Custom image" : "Add photo"}
        >
          <AspectRatio className="background-swatch-frame">
            {hasImage ? (
              <span
                className="background-swatch-paint background-current-image"
                style={{ backgroundImage: `url(${settings.image})` }}
              />
            ) : (
              <span className="background-swatch-add-placeholder" aria-hidden="true">
                <ImagePlus size={22} />
              </span>
            )}
          </AspectRatio>
          {hasImage ? "Custom" : "Add photo…"}
        </Button>
      }
    >
      <div className="colour-popover-head">
        <Text as="span" variant="label">
          Custom image
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
        value={settings.image}
        change={(image) => background({ image, kind: "image" })}
        onBusy={(v) => {
          setBusy(v);
          onBusy(v);
        }}
        hint="PNG, JPEG or WebP, up to 8 MiB."
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

function currentName(b: BackgroundSettings) {
  if (b.kind === "none") return "None";
  if (b.kind === "gradient") return titleCase(b.preset);
  if (b.kind === "image") return "Custom";
  if (b.kind === "waves") return "Waves";
  return "Aurora";
}

function StillPreview({ b }: { b: BackgroundSettings }) {
  let paint: ReactNode;
  if (b.kind === "none") {
    paint = <span className="background-swatch-paint" style={{ background: "var(--bg)" }} />;
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
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <AspectRatio className="background-swatch-frame">
        <span className="background-swatch-paint" style={{ background: paint }} />
      </AspectRatio>
      {label}
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
      {label}
    </Button>
  );
}

function StillTiles({
  b,
  background,
  onPicked,
}: {
  b: BackgroundSettings;
  background: BackgroundUpdate;
  onPicked?: () => void;
}) {
  return (
    <>
      <StillTile
        label="None"
        pressed={b.kind === "none"}
        paint="var(--bg)"
        onSelect={() => {
          background({ kind: "none" });
          onPicked?.();
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
            onPicked?.();
          }}
        />
      ))}
    </>
  );
}

function AnimatedTiles({
  b,
  background,
  onPicked,
}: {
  b: BackgroundSettings;
  background: BackgroundUpdate;
  onPicked?: () => void;
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
            onPicked?.();
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

function FolderCard({
  title,
  count,
  paint,
  dynamic = false,
  onOpen,
}: {
  title: string;
  count: number;
  paint: ReactNode;
  dynamic?: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="background-folder"
      onClick={onOpen}
    >
      <AspectRatio className="background-folder-frame" ratio={16 / 10}>
        {paint}
        {dynamic && (
          <span className="swatch-play" aria-hidden="true">
            <Play size={12} fill="currentColor" />
          </span>
        )}
        <span className="background-folder-meta">
          <span className="background-folder-title">{title}</span>
          <span className="background-folder-count">
            {count === 0
              ? "Empty"
              : count === 1
                ? "1 image"
                : `${count} images`}
          </span>
        </span>
      </AspectRatio>
    </Button>
  );
}

function HorizontalStrip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollByPage = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <div className="background-strip">
      <IconButton
        variant="quiet"
        label={`Scroll ${label} left`}
        className="background-strip-chevron"
        onClick={() => scrollByPage(-1)}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </IconButton>
      <div
        ref={scroller}
        className="background-strip-scroller"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
      <IconButton
        variant="quiet"
        label={`Scroll ${label} right`}
        className="background-strip-chevron"
        onClick={() => scrollByPage(1)}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </IconButton>
    </div>
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
    onPreviewAdjust?.(motionOpen || overlayOpen);
    return () => onPreviewAdjust?.(false);
  }, [motionOpen, overlayOpen, onPreviewAdjust]);

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
  const pickBackground = () => {
    setCollection(null);
    setLibraryOpen(false);
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
  const myImagesPaint =
    b.image ? (
      <span
        className="background-swatch-paint background-current-image"
        style={{ backgroundImage: `url(${b.image})` }}
      />
    ) : (
      <span className="background-swatch-add-placeholder" aria-hidden="true">
        <ImagePlus size={28} />
      </span>
    );

  return (
    <>
      <SettingsGroup className="background-current-group">
        <SettingsRow>
          <div className="background-current">
            <StillPreview b={b} />
            <div className="background-current-meta">
              <Text as="span" variant="support" className="background-current-eyebrow">
                Currently set
              </Text>
              <Text as="span" variant="label" className="background-current-name">
                {currentName(b)}
              </Text>
              <div className="background-current-actions">
                <Button type="button" onClick={() => setLibraryOpen(true)}>
                  Change wallpaper
                </Button>
                {b.kind === "image" && (
                  <Label className="background-current-position">
                    <span>Image position</span>
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
                  </Label>
                )}
              </div>
            </div>
          </div>
        </SettingsRow>
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
          title={collection ? collectionTitle : "Choose wallpaper"}
          close={closeLibrary}
          className="background-library-dialog"
        >
          {collection ? (
            <>
              <div className="background-collection-back">
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => {
                    setCustomOpen(false);
                    setCollection(null);
                  }}
                >
                  Back
                </Button>
              </div>
              {collection === "my-images" && (
                <HorizontalStrip label="My images">
                  <BackgroundCustomAdd
                    settings={b}
                    onBusy={onBusy}
                    background={background}
                    open={customOpen}
                    onOpenChange={setCustomOpen}
                    onConfirmed={pickBackground}
                  />
                </HorizontalStrip>
              )}
              {collection === "gradients" && (
                <HorizontalStrip label="Gradients">
                  <StillTiles
                    b={b}
                    background={background}
                    onPicked={pickBackground}
                  />
                </HorizontalStrip>
              )}
              {collection === "dynamic" && (
                <HorizontalStrip label="Dynamic">
                  <AnimatedTiles
                    b={b}
                    background={background}
                    onPicked={pickBackground}
                  />
                </HorizontalStrip>
              )}
            </>
          ) : (
            <div className="background-folders" role="group" aria-label="Wallpaper categories">
              <FolderCard
                title="My images"
                count={b.image ? 1 : 0}
                paint={myImagesPaint}
                onOpen={() => setCollection("my-images")}
              />
              <FolderCard
                title="Gradients"
                count={COLLECTIONS[1].count}
                paint={
                  <span
                    className="background-swatch-paint"
                    style={{ background: gradients.ocean }}
                  />
                }
                onOpen={() => setCollection("gradients")}
              />
              <FolderCard
                title="Dynamic"
                count={COLLECTIONS[2].count}
                dynamic
                paint={
                  <span
                    className={`swatch-mini-scene scene-waves`}
                    style={{ background: gradients.dusk }}
                  >
                    <span className="scene-motion" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                }
                onOpen={() => setCollection("dynamic")}
              />
            </div>
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
