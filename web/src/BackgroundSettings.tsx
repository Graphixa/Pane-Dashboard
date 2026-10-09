import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ColourField,
  ColourPopoverFields,
  IconButton,
  Modal,
  Popover,
  PopoverHead,
  Range,
  ScrollArea,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  useConfirmation,
  useDeferredColour,
} from "./design/components";
import { prepareUpload } from "./ImageField";
import {
  accentPresets,
  defaultBackground,
  effectIds,
  effectLabels,
  gradients,
  mediaRefEqual,
  mediaSrc,
  motionStyleLabels,
  motionStyles,
  prependLibrary,
  solidBackgroundPaint,
  wallpaperLabel,
  type Background,
  type Effect,
  type EffectId,
  type MediaRef,
  type MotionStyle,
  type Wallpaper,
} from "./appearance";
import { getEffectPack, listEffectPacks } from "./effects/registry";

type BackgroundUpdate = (update: Partial<Background>) => void;

function titleCase(id: string) {
  return id[0].toUpperCase() + id.slice(1);
}

function assetRefFromPath(path: string): MediaRef | null {
  const m = path.match(/^\/media\/assets\/([A-Za-z0-9_-]{1,128})$/);
  return m ? { source: "asset", assetId: m[1] } : null;
}

function chipInk(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#ffffff";
  const y = ((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114;
  return y > 160000 ? "#1a222e" : "#ffffff";
}

/** Live-paint the solid wallpaper base while the custom chip is dragged. */
function paintSolidWallpaper(hex: string) {
  const paint = solidBackgroundPaint(hex);
  document.querySelectorAll<HTMLElement>(".scene, .scene-base").forEach((node) => {
    node.style.background = paint;
  });
}

function StillPreview({ b }: { b: Background }) {
  const w = b.wallpaper;
  let paint: ReactNode;
  if (w.kind === "none") {
    paint = <span className="background-swatch-paint" style={{ background: "var(--bg)" }} />;
  } else if (w.kind === "solid") {
    paint = (
      <span
        className="background-swatch-paint"
        style={{ background: solidBackgroundPaint(w.colour) }}
      />
    );
  } else if (w.kind === "gradient") {
    paint = (
      <span
        className="background-swatch-paint"
        style={{ background: gradients[w.preset] }}
      />
    );
  } else {
    paint = (
      <span
        className="background-swatch-paint background-current-image"
        style={{
          backgroundImage: `url(${mediaSrc(w.media)})`,
          backgroundPosition: w.position,
        }}
      />
    );
  }
  return (
    <div className="background-current-preview">
      <div className="ui-aspect-ratio background-current-frame">{paint}</div>
    </div>
  );
}

/** Horizontal shelf: tiles sit in a settings-group inset and clip there. */
function WallpaperShelf({
  heading,
  label,
  compact = false,
  children,
}: {
  heading: string;
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`background-shelf${compact ? " background-shelf-compact" : ""}`}>
      <div className="background-shelf-head">
        <Text as="h3" variant="label" className="background-shelf-heading">
          {heading}
        </Text>
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
    paintLive: paintSolidWallpaper,
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

function MediaTile({
  label,
  pressed,
  src,
  onSelect,
  onRemove,
}: {
  label: string;
  pressed: boolean;
  src?: string;
  onSelect: () => void;
  onRemove?: () => void;
}) {
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
          {src ? (
            <span
              className="background-swatch-paint background-current-image"
              style={{ backgroundImage: `url(${src})` }}
            />
          ) : (
            <span className="background-swatch-paint" style={{ background: "var(--panel-high)" }}>
              <span className="swatch-dynamic-label">Video</span>
            </span>
          )}
        </div>
      </Button>
      {onRemove && (
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
      )}
    </div>
  );
}

function UploadTile({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  return (
    <label className="background-swatch background-swatch-add">
      <div className="ui-aspect-ratio background-swatch-frame">
        <span className="background-swatch-add-placeholder" aria-hidden="true">
          <Plus size={22} />
        </span>
      </div>
      <span className="file-picker-label">{label}</span>
      <input
        type="file"
        accept={accept}
        className="file-picker"
        aria-label={label}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return <div className="background-row-actions">{children}</div>;
}

export default function BackgroundSettings({
  settings: b,
  theme,
  onBusy,
  background,
  onPreviewAdjust,
}: {
  settings: Background;
  theme: "dark" | "light";
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  onPreviewAdjust?: (active: boolean) => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [tab, setTab] = useState<"static" | "animated">("static");
  const [motionOpen, setMotionOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [tintOpen, setTintOpen] = useState(false);
  const snapshot = useRef<Background | null>(null);
  const lastMotion = useRef<MotionStyle>(
    b.photoMotion.style !== "none" ? b.photoMotion.style : "ken-burns",
  );
  const lastEffect = useRef<Effect | undefined>(b.effect);
  const lastTint = useRef(b.tint);

  useEffect(() => {
    if (b.photoMotion.style !== "none") lastMotion.current = b.photoMotion.style;
  }, [b.photoMotion.style]);
  useEffect(() => {
    if (b.effect) lastEffect.current = b.effect;
  }, [b.effect]);
  useEffect(() => {
    if (b.tint) lastTint.current = b.tint;
  }, [b.tint]);
  useEffect(() => {
    onPreviewAdjust?.(chooserOpen || motionOpen || effectOpen || tintOpen);
    return () => onPreviewAdjust?.(false);
  }, [chooserOpen, motionOpen, effectOpen, tintOpen, onPreviewAdjust]);

  const openChooser = () => {
    snapshot.current = structuredClone(b);
    const kind = b.wallpaper.kind;
    setTab(kind === "video" ? "animated" : "static");
    setChooserOpen(true);
  };
  const discardChooser = () => {
    if (snapshot.current) background(snapshot.current);
    snapshot.current = null;
    setChooserOpen(false);
  };
  const commitChooser = () => {
    snapshot.current = null;
    setChooserOpen(false);
  };

  const setWallpaper = (wallpaper: Wallpaper, library = b.library) => {
    background({ wallpaper, library });
  };

  const selectColour = (colour: string) => {
    setWallpaper({ kind: "solid", colour });
  };
  const selectGradient = (preset: keyof typeof gradients) => {
    setWallpaper({ kind: "gradient", preset });
  };
  const selectMedia = (ref: MediaRef, kind: "image" | "video") => {
    let library = b.library;
    try {
      library = prependLibrary(b.library, ref);
    } catch (err) {
      void confirm({
        title: "Library full",
        description: (err as Error).message,
        cancelLabel: "OK",
        actionLabel: "OK",
      });
      return;
    }
    if (kind === "image") {
      setWallpaper({ kind: "image", media: ref, position: "center" }, library);
    } else {
      setWallpaper(
        { kind: "video", media: ref, position: "center", playback: "loop" },
        library,
      );
    }
  };

  const upload = async (file: File) => {
    onBusy(true);
    try {
      const path = await prepareUpload(file, "background");
      const ref = assetRefFromPath(path);
      if (!ref) throw Error("Invalid media response.");
      const kind = file.type.startsWith("video/") ? "video" : "image";
      selectMedia(ref, kind);
      setTab(kind === "video" ? "animated" : "static");
    } catch (err) {
      await confirm({
        title: "Upload failed",
        description: (err as Error).message,
        cancelLabel: "OK",
        actionLabel: "OK",
      });
    } finally {
      onBusy(false);
    }
  };

  const removeLibraryRef = async (ref: MediaRef, index: number) => {
    const ok = await confirm({
      title: "Remove media?",
      description: "Remove this item from My media? This cannot be undone from here.",
      cancelLabel: "Keep",
      actionLabel: "Remove",
      actionVariant: "danger",
    });
    if (!ok) return;
    const next = b.library.filter((x) => !mediaRefEqual(x, ref));
    const active =
      (b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
      mediaRefEqual(b.wallpaper.media, ref);
    if (active) background({ library: next, wallpaper: { kind: "none" } });
    else background({ library: next });
    void index;
  };

  const solidSelected =
    b.wallpaper.kind === "solid" ? b.wallpaper.colour.toLowerCase() : "";
  const presetMatch = accentPresets[theme].some(
    (p) => p.colour.toLowerCase() === solidSelected,
  );
  const customColour =
    b.wallpaper.kind === "solid" ? b.wallpaper.colour : "#a2cbbb";

  const isActiveImage = (ref: MediaRef) =>
    b.wallpaper.kind === "image" && mediaRefEqual(b.wallpaper.media, ref);
  const isActiveVideo = (ref: MediaRef) =>
    b.wallpaper.kind === "video" && mediaRefEqual(b.wallpaper.media, ref);

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
                {wallpaperLabel(b)}
              </Text>
              <Button
                type="button"
                className="background-current-change"
                onClick={openChooser}
              >
                Change wallpaper
              </Button>
            </div>
          </div>
        </SettingsRow>
      </SettingsGroup>

      {(b.wallpaper.kind === "image" || b.wallpaper.kind === "video") && (
        <SettingsGroup>
          <SettingsRow label="Image position">
            <Select
              aria-label="Image position"
              value={b.wallpaper.position}
              onValueChange={(position) => {
                if (b.wallpaper.kind !== "image" && b.wallpaper.kind !== "video")
                  return;
                background({
                  wallpaper: {
                    ...b.wallpaper,
                    position: position as "center" | "top" | "bottom",
                  },
                });
              }}
            >
              <SelectOption value="center">Centre</SelectOption>
              <SelectOption value="top">Top</SelectOption>
              <SelectOption value="bottom">Bottom</SelectOption>
            </Select>
          </SettingsRow>
          {b.wallpaper.kind === "video" && (
            <SettingsRow label="Playback">
              <Select
                aria-label="Video playback"
                value={b.wallpaper.playback}
                onValueChange={(playback) => {
                  if (b.wallpaper.kind !== "video") return;
                  background({
                    wallpaper: {
                      ...b.wallpaper,
                      playback: playback === "static" ? "static" : "loop",
                    },
                  });
                }}
              >
                <SelectOption value="loop">Loop</SelectOption>
                <SelectOption value="static">Static poster</SelectOption>
              </Select>
            </SettingsRow>
          )}
        </SettingsGroup>
      )}

      <SettingsGroup>
        {b.wallpaper.kind === "image" && (
          <SettingsRow
            label={b.photoMotion.style === "none" ? "Add motion" : "Motion"}
            hint={
              b.photoMotion.style === "none"
                ? undefined
                : motionStyleLabels[b.photoMotion.style]
            }
          >
            {b.photoMotion.style === "none" ? (
              <Button
                type="button"
                onClick={() =>
                  background({
                    photoMotion: {
                      style:
                        lastMotion.current === "none"
                          ? "ken-burns"
                          : lastMotion.current,
                      intensity: b.photoMotion.intensity || 40,
                    },
                  })
                }
              >
                <Plus size={16} aria-hidden /> Add motion
              </Button>
            ) : (
              <RowActions>
                <Button type="button" onClick={() => setMotionOpen(true)}>
                  Customise
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    background({
                      photoMotion: {
                        style: "none",
                        intensity: b.photoMotion.intensity,
                      },
                    })
                  }
                >
                  Remove
                </Button>
              </RowActions>
            )}
          </SettingsRow>
        )}

        <SettingsRow
          label={b.effect ? effectLabels[b.effect.id] : "Add effect"}
          hint={b.effect ? "Transparent particle effect" : undefined}
        >
          {!b.effect ? (
            <Button
              type="button"
              onClick={() => {
                const pack = listEffectPacks()[0];
                const params: Record<string, string | number | boolean> = {};
                for (const c of pack.controls) params[c.key] = c.default;
                background({
                  effect: lastEffect.current ?? { id: pack.id, params },
                });
              }}
            >
              <Plus size={16} aria-hidden /> Add effect
            </Button>
          ) : (
            <RowActions>
              <Button type="button" onClick={() => setEffectOpen(true)}>
                Customise
              </Button>
              <Button type="button" onClick={() => background({ effect: undefined })}>
                Remove
              </Button>
            </RowActions>
          )}
        </SettingsRow>

        <SettingsRow label={b.tint ? "Tint" : "Add tint"}>
          {!b.tint ? (
            <Button
              type="button"
              onClick={() =>
                background({
                  tint: lastTint.current ?? { colour: "#a2cbbb", opacity: 25 },
                })
              }
            >
              <Plus size={16} aria-hidden /> Add tint
            </Button>
          ) : (
            <RowActions>
              <Button type="button" onClick={() => setTintOpen(true)}>
                Customise
              </Button>
              <Button type="button" onClick={() => background({ tint: undefined })}>
                Remove
              </Button>
            </RowActions>
          )}
        </SettingsRow>

        <Text as="p" variant="support" className="background-theme-overlay-hint">
          Lightens or darkens the background to suit your theme.
        </Text>
        <Range
          label="Theme overlay"
          min={0}
          max={80}
          unit="%"
          value={b.themeOverlayOpacity}
          change={(themeOverlayOpacity) => background({ themeOverlayOpacity })}
        />
      </SettingsGroup>

      {chooserOpen && (
        <Modal
          nested
          title="Choose wallpaper"
          placement="bottom"
          backdrop="none"
          className="background-library-dialog"
          close={discardChooser}
        >
          <Tabs
            className="background-library-tabs"
            value={tab}
            onValueChange={(v) => setTab(v as "static" | "animated")}
          >
            <TabsList aria-label="Wallpaper type">
              <TabsTrigger value="static">Static</TabsTrigger>
              <TabsTrigger value="animated">Animated</TabsTrigger>
            </TabsList>
            <TabsContent value="static" className="background-library-tab-panel">
              <ScrollArea
                className="background-library-body-scroll"
                type="auto"
                aria-label="Static wallpapers"
              >
                <div className="background-library-shelves">
                  <WallpaperShelf heading="Colours" label="Colours" compact>
                    <WallpaperCustomColour
                      colour={customColour}
                      pressed={b.wallpaper.kind === "solid" && !presetMatch}
                      onColour={selectColour}
                    />
                    {accentPresets[theme].map((p) => (
                      <WallpaperColourChip
                        key={p.colour}
                        name={p.name}
                        colour={p.colour}
                        pressed={solidSelected === p.colour.toLowerCase()}
                        onSelect={() => selectColour(p.colour)}
                      />
                    ))}
                  </WallpaperShelf>

                  <WallpaperShelf heading="My media" label="My media">
                    <UploadTile
                      label="Upload image"
                      accept="image/png,image/jpeg,image/webp"
                      onFile={(f) => void upload(f)}
                    />
                    {b.library.map((ref, index) => (
                      <MediaTile
                        key={mediaSrc(ref)}
                        label={`My media ${index + 1}`}
                        pressed={isActiveImage(ref)}
                        src={mediaSrc(ref)}
                        onSelect={() => selectMedia(ref, "image")}
                        onRemove={() => void removeLibraryRef(ref, index)}
                      />
                    ))}
                    <StillTile
                      label="None"
                      pressed={b.wallpaper.kind === "none"}
                      paint="var(--bg)"
                      onSelect={() => setWallpaper({ kind: "none" })}
                    />
                  </WallpaperShelf>

                  <WallpaperShelf heading="Gradients" label="Gradients">
                    {(Object.keys(gradients) as (keyof typeof gradients)[]).map(
                      (id) => (
                        <StillTile
                          key={id}
                          label={titleCase(id)}
                          pressed={
                            b.wallpaper.kind === "gradient" &&
                            b.wallpaper.preset === id
                          }
                          paint={gradients[id]}
                          onSelect={() => selectGradient(id)}
                        />
                      ),
                    )}
                  </WallpaperShelf>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="animated" className="background-library-tab-panel">
              <ScrollArea
                className="background-library-body-scroll"
                type="auto"
                aria-label="Animated wallpapers"
              >
                <div className="background-library-shelves">
                  <WallpaperShelf heading="Videos" label="Videos">
                    <UploadTile
                      label="Upload video"
                      accept="video/webm,video/mp4"
                      onFile={(f) => void upload(f)}
                    />
                    {b.library.map((ref, index) => (
                      <MediaTile
                        key={`v-${mediaSrc(ref)}`}
                        label={`Video ${index + 1}`}
                        pressed={isActiveVideo(ref)}
                        onSelect={() => selectMedia(ref, "video")}
                      />
                    ))}
                  </WallpaperShelf>
                  <Text as="p" variant="support">
                    Built-in video loops will appear here once catalogue artwork is
                    selected.
                  </Text>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <div className="ui-actions background-library-actions">
            <Button type="button" variant="primary" onClick={commitChooser}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {motionOpen && (
        <Modal
          nested
          title="Motion"
          placement="bottom"
          backdrop="none"
          className="background-adjust-dialog"
          close={() => setMotionOpen(false)}
        >
          <SettingsGroup>
            <SettingsRow label="Style">
              <Select
                aria-label="Motion style"
                value={b.photoMotion.style}
                onValueChange={(style) =>
                  background({
                    photoMotion: {
                      style: style as MotionStyle,
                      intensity: b.photoMotion.intensity,
                    },
                  })
                }
              >
                {motionStyles.map((id) => (
                  <SelectOption key={id} value={id}>
                    {motionStyleLabels[id]}
                  </SelectOption>
                ))}
              </Select>
            </SettingsRow>
            <Range
              label="Intensity"
              min={0}
              max={100}
              unit="%"
              value={b.photoMotion.intensity}
              change={(intensity) =>
                background({ photoMotion: { ...b.photoMotion, intensity } })
              }
            />
          </SettingsGroup>
          <div className="ui-actions">
            <Button variant="primary" onClick={() => setMotionOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {effectOpen && b.effect && (
        <Modal
          nested
          title="Effect"
          placement="bottom"
          backdrop="none"
          className="background-adjust-dialog"
          close={() => setEffectOpen(false)}
        >
          <SettingsGroup>
            <SettingsRow label="Effect">
              <Select
                aria-label="Effect"
                value={b.effect.id}
                onValueChange={(id) => {
                  const pack = getEffectPack(id);
                  if (!pack) return;
                  const params: Record<string, string | number | boolean> = {
                    ...(b.effect?.params ?? {}),
                  };
                  for (const c of pack.controls) {
                    if (params[c.key] === undefined) params[c.key] = c.default;
                  }
                  background({ effect: { id: id as EffectId, params } });
                }}
              >
                {effectIds.map((id) => (
                  <SelectOption key={id} value={id}>
                    {effectLabels[id]}
                  </SelectOption>
                ))}
              </Select>
            </SettingsRow>
            {getEffectPack(b.effect.id)?.controls.map((c) =>
              c.type === "colour" ? (
                <ColourField
                  key={c.key}
                  label={c.label}
                  colour={String(b.effect?.params[c.key] ?? c.default)}
                  onColour={(colour) =>
                    background({
                      effect: {
                        id: b.effect!.id,
                        params: { ...b.effect!.params, [c.key]: colour },
                      },
                    })
                  }
                />
              ) : (
                <Range
                  key={c.key}
                  label={c.label}
                  min={c.min}
                  max={c.max}
                  value={Number(b.effect?.params[c.key] ?? c.default)}
                  change={(n) =>
                    background({
                      effect: {
                        id: b.effect!.id,
                        params: { ...b.effect!.params, [c.key]: n },
                      },
                    })
                  }
                />
              ),
            )}
          </SettingsGroup>
          <div className="ui-actions">
            <Button variant="primary" onClick={() => setEffectOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {tintOpen && b.tint && (
        <Modal
          nested
          title="Tint"
          placement="bottom"
          backdrop="none"
          className="background-adjust-dialog"
          close={() => setTintOpen(false)}
        >
          <SettingsGroup>
            <ColourField
              label="Colour"
              colour={b.tint.colour}
              onColour={(colour) => background({ tint: { ...b.tint!, colour } })}
            />
            <Range
              label="Opacity"
              min={0}
              max={80}
              unit="%"
              value={b.tint.opacity}
              change={(opacity) => background({ tint: { ...b.tint!, opacity } })}
            />
          </SettingsGroup>
          <div className="ui-actions">
            <Button variant="primary" onClick={() => setTintOpen(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

void defaultBackground;
