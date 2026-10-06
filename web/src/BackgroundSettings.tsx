import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Play, Plus, X } from "lucide-react";
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
}: {
  settings: BackgroundSettings;
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    <div className="background-current-thumb">
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

function ShelfHeader({
  title,
  count,
  onShowAll,
  onAdd,
}: {
  title: string;
  count: number;
  onShowAll: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="background-shelf-head">
      <Text as="h4" variant="label">
        {title}
      </Text>
      <div className="background-shelf-actions">
        {onAdd && (
          <IconButton
            variant="quiet"
            label="Add wallpaper"
            className="background-shelf-add"
            onClick={onAdd}
          >
            <Plus size={16} aria-hidden="true" />
          </IconButton>
        )}
        <Button
          type="button"
          variant="quiet"
          className="background-show-all"
          onClick={onShowAll}
        >
          {`Show All (${count})`}
        </Button>
      </div>
    </div>
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

const WALLPAPER_COUNT = 1 + Object.keys(gradients).length;
const DYNAMIC_COUNT = 2;

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
  const [gallery, setGallery] = useState<"wallpapers" | "dynamic" | null>(null);
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

  return (
    <>
      <SettingsGroup className="background-current-group">
        <SettingsRow>
          <div className="background-current">
            <StillPreview b={b} />
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
          </>
        )}
      </SettingsGroup>

      <div className="background-shelf">
        <div className="background-shelf-head">
          <Text as="h4" variant="label">
            User
          </Text>
        </div>
        <SettingsGroup className="background-shelf-group">
          <SettingsRow>
            <div
              className="background-gallery background-gallery-shelf"
              role="group"
              aria-label="User backgrounds"
            >
              <BackgroundCustomAdd
                settings={b}
                onBusy={onBusy}
                background={background}
                open={customOpen}
                onOpenChange={setCustomOpen}
              />
            </div>
          </SettingsRow>
        </SettingsGroup>
      </div>

      <div className="background-shelf">
        <ShelfHeader
          title="Wallpapers"
          count={WALLPAPER_COUNT}
          onShowAll={() => setGallery("wallpapers")}
          onAdd={() => setCustomOpen(true)}
        />
        <SettingsGroup className="background-shelf-group">
          <SettingsRow>
            <div
              className="background-gallery background-gallery-shelf"
              role="group"
              aria-label="Wallpaper backgrounds"
            >
              <StillTiles b={b} background={background} />
            </div>
          </SettingsRow>
        </SettingsGroup>
      </div>

      <div className="background-shelf">
        <ShelfHeader
          title="Dynamic"
          count={DYNAMIC_COUNT}
          onShowAll={() => setGallery("dynamic")}
        />
        <SettingsGroup className="background-shelf-group">
          <SettingsRow>
            <div
              className="background-gallery background-gallery-shelf"
              role="group"
              aria-label="Dynamic backgrounds"
            >
              <AnimatedTiles b={b} background={background} />
            </div>
          </SettingsRow>
        </SettingsGroup>
      </div>

      {gallery && (
        <Modal
          nested
          title={gallery === "wallpapers" ? "Wallpapers" : "Dynamic"}
          close={() => setGallery(null)}
          className="background-gallery-dialog"
        >
          <div
            className="background-gallery background-gallery-grid"
            role="group"
            aria-label={
              gallery === "wallpapers"
                ? "All wallpaper backgrounds"
                : "All dynamic backgrounds"
            }
          >
            {gallery === "wallpapers" ? (
              <StillTiles
                b={b}
                background={background}
                onPicked={() => setGallery(null)}
              />
            ) : (
              <AnimatedTiles
                b={b}
                background={background}
                onPicked={() => setGallery(null)}
              />
            )}
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
    </>
  );
}
