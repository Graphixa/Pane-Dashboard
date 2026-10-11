import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ColourField,
  ColourPopoverFields,
  IconButton,
  Modal,
  Notice,
  Popover,
  PopoverHead,
  Range,
  ScrollArea,
  Section,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  Switch,
  Text,
  useDeferredColour,
} from "./design/components";
import { prepareUpload } from "./ImageField";
import {
  accentPresets,
  defaultBackground,
  effectIds,
  effectLabels,
  gradients,
  mediaDisplayName,
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
import { getEffectPack } from "./effects/registry";

type MediaKind = "image" | "video";

function assetIdFromRef(ref: MediaRef): string | null {
  return ref.source === "asset" ? ref.assetId : null;
}

/** Resolve image vs video for library tiles (HEAD Content-Type; seed from wallpaper/upload). */
function useMediaKinds(library: MediaRef[], wallpaper: Wallpaper) {
  const [kinds, setKinds] = useState<Map<string, MediaKind>>(() => new Map());

  const remember = (ref: MediaRef, kind: MediaKind) => {
    const key = mediaSrc(ref);
    setKinds((prev) => {
      if (prev.get(key) === kind) return prev;
      const next = new Map(prev);
      next.set(key, kind);
      return next;
    });
  };

  useEffect(() => {
    if (wallpaper.kind === "image") remember(wallpaper.media, "image");
    if (wallpaper.kind === "video") remember(wallpaper.media, "video");
    // wallpaper identity only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallpaper]);

  useEffect(() => {
    let cancelled = false;
    const missing = library.filter((ref) => !kinds.has(mediaSrc(ref)));
    if (!missing.length) return;
    void (async () => {
      const found = new Map<string, MediaKind>();
      await Promise.all(
        missing.map(async (ref) => {
          const key = mediaSrc(ref);
          if (ref.source === "url") {
            found.set(key, "image");
            return;
          }
          try {
            const res = await fetch(key, { method: "HEAD" });
            const ct = (res.headers.get("content-type") || "").toLowerCase();
            found.set(key, ct.startsWith("video/") ? "video" : "image");
          } catch {
            found.set(key, "image");
          }
        }),
      );
      if (cancelled || !found.size) return;
      setKinds((prev) => {
        const next = new Map(prev);
        found.forEach((kind, key) => next.set(key, kind));
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // kinds read for skip; library drives re-probe of new entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  return { kinds, remember };
}

/** Resolve stored upload display names from media meta (not stored on MediaRef). */
function useMediaNames(library: MediaRef[]) {
  const [names, setNames] = useState<Map<string, string>>(() => new Map());

  const remember = (ref: MediaRef, name: string) => {
    const key = mediaSrc(ref);
    const trimmed = name.trim();
    if (!trimmed) return;
    setNames((prev) => {
      if (prev.get(key) === trimmed) return prev;
      const next = new Map(prev);
      next.set(key, trimmed);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const missing = library.filter((ref) => {
      const id = assetIdFromRef(ref);
      return id && !names.has(mediaSrc(ref));
    });
    if (!missing.length) return;
    void (async () => {
      const found = new Map<string, string>();
      await Promise.all(
        missing.map(async (ref) => {
          const id = assetIdFromRef(ref);
          if (!id) return;
          const key = mediaSrc(ref);
          try {
            const res = await fetch(`/api/media/meta/${id}`);
            if (!res.ok) return;
            const body = (await res.json()) as { name?: string };
            if (typeof body.name === "string" && body.name.trim()) {
              found.set(key, body.name.trim());
            }
          } catch {
            /* ignore missing meta */
          }
        }),
      );
      if (cancelled || !found.size) return;
      setNames((prev) => {
        const next = new Map(prev);
        found.forEach((name, key) => next.set(key, name));
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  return { names, remember };
}

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
  } else if (w.kind === "video") {
    paint = (
      <video
        className="background-swatch-paint background-swatch-video"
        src={mediaSrc(w.media)}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
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
        {pressed ? (
          <span className="background-swatch-check" aria-hidden="true">
            <Check size={16} strokeWidth={2.75} />
          </span>
        ) : null}
      </div>
    </Button>
  );
}

function VideoThumb({ src }: { src: string }) {
  return (
    <video
      className="background-swatch-paint background-swatch-video"
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  );
}

function MediaTile({
  label,
  pressed,
  src,
  kind = "image",
  onSelect,
  onRemove,
}: {
  label: string;
  pressed: boolean;
  src: string;
  kind?: MediaKind;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const a11y = `${label}, ${kind === "video" ? "video" : "image"}`;
  return (
    <div className="background-swatch-wrap">
      <Button
        variant="surface"
        type="button"
        className="background-swatch"
        aria-label={a11y}
        title={label}
        aria-pressed={pressed}
        onClick={onSelect}
      >
        <div className="ui-aspect-ratio background-swatch-frame">
          {kind === "video" ? (
            <VideoThumb src={src} />
          ) : (
            <span
              className="background-swatch-paint background-current-image"
              style={{ backgroundImage: `url(${src})` }}
            />
          )}
          {pressed ? (
            <span className="background-swatch-check" aria-hidden="true">
              <Check size={16} strokeWidth={2.75} />
            </span>
          ) : null}
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
  const [chooserOpen, setChooserOpen] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [pendingRemove, setPendingRemove] = useState<MediaRef | null>(null);
  const [motionOpen, setMotionOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [tintOpen, setTintOpen] = useState(false);
  const { kinds: mediaKinds, remember: rememberMediaKind } = useMediaKinds(
    b.library,
    b.wallpaper,
  );
  const { names: mediaNames, remember: rememberMediaName } = useMediaNames(
    b.library,
  );
  const snapshot = useRef<Background | null>(null);
  const lastMotion = useRef<MotionStyle>(
    b.photoMotion.style !== "none" ? b.photoMotion.style : "ken-burns",
  );
  const lastEffect = useRef<Effect | undefined>(b.effect);
  const lastTint = useRef(b.tint);
  const motionHelpId = useId();
  const motionUnavailable = b.wallpaper.kind !== "image";
  const motionUnavailableHelp =
    "Not available for live or video wallpapers.";

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
    setSheetError("");
    setPendingRemove(null);
    setChooserOpen(true);
  };
  const discardChooser = () => {
    if (snapshot.current) background(snapshot.current);
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
    setChooserOpen(false);
  };
  const commitChooser = () => {
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
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
    const known = b.library.some((entry) => mediaRefEqual(entry, ref));
    let library = b.library;
    if (!known) {
      try {
        library = prependLibrary(b.library, ref);
      } catch (err) {
        // Inline in the sheet: nested AlertDialog over Choose wallpaper cannot receive clicks.
        setSheetError((err as Error).message);
        return;
      }
    }
    setSheetError("");
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
    setSheetError("");
    setPendingRemove(null);
    onBusy(true);
    try {
      const committed = await prepareUpload(file, "background");
      const ref = assetRefFromPath(committed.path);
      if (!ref) throw Error("Invalid media response.");
      rememberMediaKind(ref, committed.kind);
      rememberMediaName(ref, committed.name);
      selectMedia(ref, committed.kind);
    } catch (err) {
      setSheetError((err as Error).message);
    } finally {
      onBusy(false);
    }
  };

  const mediaLabel = (ref: MediaRef, kind: MediaKind) => {
    const stored = mediaNames.get(mediaSrc(ref));
    const fallback = kind === "video" ? "Video" : "Photo";
    return stored ? mediaDisplayName(stored, fallback) : fallback;
  };

  const currentMediaName =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? mediaNames.get(mediaSrc(b.wallpaper.media))
      : undefined;

  const requestRemoveLibraryRef = (ref: MediaRef) => {
    setSheetError("");
    setPendingRemove(ref);
  };

  const confirmRemoveLibraryRef = () => {
    const ref = pendingRemove;
    if (!ref) return;
    setPendingRemove(null);
    const next = b.library.filter((x) => !mediaRefEqual(x, ref));
    const active =
      (b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
      mediaRefEqual(b.wallpaper.media, ref);
    if (active) background({ library: next, wallpaper: { kind: "none" } });
    else background({ library: next });
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
  const mediaKindOf = (ref: MediaRef): MediaKind | undefined =>
    mediaKinds.get(mediaSrc(ref));
  const imageLibrary = b.library.filter((ref) => {
    const kind = mediaKindOf(ref);
    if (kind === "image") return true;
    if (kind === "video") return false;
    return isActiveImage(ref);
  });
  const videoLibrary = b.library.filter((ref) => {
    const kind = mediaKindOf(ref);
    if (kind === "video") return true;
    if (kind === "image") return false;
    return isActiveVideo(ref);
  });

  const mediaWallpaper =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? b.wallpaper
      : null;

  return (
    <div className="background-settings-stack">
      <SettingsGroup className="background-current-group">
        <SettingsRow>
          <div className="background-current">
            <StillPreview b={b} />
            <div className="background-current-meta">
              <Text as="span" variant="support" className="background-current-eyebrow">
                Currently set
              </Text>
              <Text as="span" variant="label" className="background-current-name">
                {wallpaperLabel(b, currentMediaName)}
              </Text>
              <Button
                type="button"
                className="background-current-change"
                onClick={openChooser}
              >
                Change wallpaper
              </Button>
            </div>
            {mediaWallpaper && (
              <div className="background-current-controls">
                <div className="background-current-control">
                  <Text as="span" variant="support" className="background-current-control-label">
                    Position
                  </Text>
                  <Select
                    aria-label="Position"
                    value={mediaWallpaper.position}
                    onValueChange={(position) => {
                      if (
                        b.wallpaper.kind !== "image" &&
                        b.wallpaper.kind !== "video"
                      )
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
                </div>
                {b.wallpaper.kind === "video" && (
                  <div className="background-current-control">
                    <Text as="span" variant="support" className="background-current-control-label">
                      Playback
                    </Text>
                    <Select
                      aria-label="Playback"
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
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingsRow>
      </SettingsGroup>

      <Section title="Enhancements" level="h3" className="settings-section">
        <SettingsGroup>
          <SettingsRow
            label="Tint"
            action={
              <Button
                type="button"
                variant="quiet"
                className="background-effect-customize"
                disabled={!b.tint}
                aria-label="Customise tint"
                onClick={() => setTintOpen(true)}
              >
                Customise
              </Button>
            }
          >
            <Switch
              aria-label="Tint"
              checked={Boolean(b.tint)}
              onCheckedChange={(on) => {
                if (on) {
                  background({
                    tint: lastTint.current ?? { colour: "#a2cbbb", opacity: 25 },
                  });
                  return;
                }
                setTintOpen(false);
                background({ tint: undefined });
              }}
            />
          </SettingsRow>

          <SettingsRow
            label="Screen Effects"
            action={
              <Button
                type="button"
                variant="quiet"
                className="background-effect-customize"
                disabled={!b.effect}
                aria-label="Customise screen effects"
                onClick={() => setEffectOpen(true)}
              >
                Customise
              </Button>
            }
          >
            <Select
              aria-label="Screen Effects"
              value={b.effect?.id ?? "none"}
              onValueChange={(id) => {
                if (id === "none") {
                  background({ effect: undefined });
                  setEffectOpen(false);
                  return;
                }
                const pack = getEffectPack(id);
                if (!pack) return;
                const prev =
                  lastEffect.current?.id === id ? lastEffect.current : undefined;
                const params: Record<string, string | number | boolean> = {
                  ...(prev?.params ?? {}),
                };
                for (const c of pack.controls) {
                  if (params[c.key] === undefined) params[c.key] = c.default;
                }
                background({ effect: { id: id as EffectId, params } });
              }}
            >
              <SelectOption value="none">None</SelectOption>
              {effectIds.map((id) => (
                <SelectOption key={id} value={id}>
                  {effectLabels[id]}
                </SelectOption>
              ))}
            </Select>
          </SettingsRow>

          <SettingsRow
            label="Add Motion"
            action={
              <span
                className="background-motion-tip"
                title={motionUnavailable ? motionUnavailableHelp : undefined}
              >
                <Button
                  type="button"
                  variant="quiet"
                  className="background-effect-customize"
                  disabled={
                    motionUnavailable || b.photoMotion.style === "none"
                  }
                  aria-label="Customise motion"
                  aria-describedby={
                    motionUnavailable ? motionHelpId : undefined
                  }
                  onClick={() => setMotionOpen(true)}
                >
                  Customise
                </Button>
              </span>
            }
          >
            <span
              className="background-motion-tip"
              title={motionUnavailable ? motionUnavailableHelp : undefined}
            >
              {motionUnavailable && (
                <span id={motionHelpId} className="background-visually-hidden">
                  {motionUnavailableHelp}
                </span>
              )}
              <Select
                aria-label="Add Motion"
                aria-describedby={
                  motionUnavailable ? motionHelpId : undefined
                }
                disabled={motionUnavailable}
                value={b.photoMotion.style}
                onValueChange={(style) => {
                  if (motionUnavailable) return;
                  const next = style as MotionStyle;
                  if (next === "none") {
                    setMotionOpen(false);
                    background({
                      photoMotion: {
                        style: "none",
                        intensity: b.photoMotion.intensity,
                      },
                    });
                    return;
                  }
                  background({
                    photoMotion: {
                      style: next,
                      intensity: b.photoMotion.intensity || 40,
                    },
                  });
                }}
              >
                {motionStyles.map((id) => (
                  <SelectOption key={id} value={id}>
                    {motionStyleLabels[id]}
                  </SelectOption>
                ))}
              </Select>
            </span>
          </SettingsRow>
        </SettingsGroup>
      </Section>

      <Section title="Readability" level="h3" className="settings-section">
        <SettingsGroup>
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
      </Section>

      {chooserOpen && (
        <Modal
          nested
          title="Choose wallpaper"
          placement="bottom"
          backdrop="none"
          className="background-library-dialog"
          close={discardChooser}
        >
          {sheetError && (
            <Notice tone="error" className="background-library-sheet-notice">
              {sheetError}
            </Notice>
          )}
          {pendingRemove && (
            <Notice tone="error" banner className="background-library-sheet-notice">
              <span>
                {(b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
                mediaRefEqual(b.wallpaper.media, pendingRemove)
                  ? "Remove this item from the draft library? Your current wallpaper will become None until you choose another. Closing this sheet without Use wallpaper restores the previous draft; Settings Cancel restores the saved appearance."
                  : "Remove this item from the draft library? Closing this sheet without Use wallpaper restores the previous draft; Settings Cancel restores the saved appearance. Files still referenced by the saved config are kept on disk."}
              </span>
              <div className="ui-actions">
                <Button type="button" onClick={() => setPendingRemove(null)}>
                  Keep
                </Button>
                <Button type="button" variant="danger" onClick={confirmRemoveLibraryRef}>
                  Remove
                </Button>
              </div>
            </Notice>
          )}
          <ScrollArea
            className="background-library-body-scroll"
            type="auto"
            aria-label="Wallpapers"
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
                {imageLibrary.map((ref) => (
                  <MediaTile
                    key={mediaSrc(ref)}
                    label={mediaLabel(ref, "image")}
                    pressed={isActiveImage(ref)}
                    src={mediaSrc(ref)}
                    kind="image"
                    onSelect={() => selectMedia(ref, "image")}
                    onRemove={() => requestRemoveLibraryRef(ref)}
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

              <WallpaperShelf heading="Videos" label="Videos">
                <UploadTile
                  label="Upload video"
                  accept="video/webm,video/mp4"
                  onFile={(f) => void upload(f)}
                />
                {videoLibrary.map((ref) => (
                  <MediaTile
                    key={`v-${mediaSrc(ref)}`}
                    label={mediaLabel(ref, "video")}
                    pressed={isActiveVideo(ref)}
                    src={mediaSrc(ref)}
                    kind="video"
                    onSelect={() => selectMedia(ref, "video")}
                    onRemove={() => requestRemoveLibraryRef(ref)}
                  />
                ))}
              </WallpaperShelf>
              <Text as="p" variant="support" className="background-library-note">
                Upload a muted loop to use as an animated wallpaper.
              </Text>
            </div>
          </ScrollArea>
          <div className="background-library-actions">
            <Text as="p" variant="support" className="background-library-actions-note">
              Confirms this wallpaper in the Settings draft. Use Apply to save.
            </Text>
            <div className="ui-actions">
              <Button type="button" variant="primary" onClick={commitChooser}>
                Use wallpaper
              </Button>
            </div>
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
          title="Screen Effects"
          placement="bottom"
          backdrop="none"
          className="background-adjust-dialog"
          close={() => setEffectOpen(false)}
        >
          <SettingsGroup>
            <SettingsRow label="Effect">
              <Select
                aria-label="Screen effect"
                value={b.effect.id}
                onValueChange={(id) => {
                  const pack = getEffectPack(id);
                  if (!pack) return;
                  const prev =
                    lastEffect.current?.id === id
                      ? lastEffect.current
                      : undefined;
                  const params: Record<string, string | number | boolean> = {
                    ...(prev?.params ?? {}),
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
    </div>
  );
}

void defaultBackground;
