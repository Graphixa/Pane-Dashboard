import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  ColourField,
  Modal,
  Notice,
  Range,
  ScrollArea,
  Section,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  Switch,
  Text,
  useConfirmation,
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
import {
  builtinMediaUrl,
  builtinPosterUrl,
  wallpaperCatalogueCategories,
  wallpaperCatalogueItems,
} from "./generated/wallpaperCatalogue";
import {
  loadRecentWallpapers,
  wallpaperMatches,
  type RecentWallpaperEntry,
} from "./wallpaperRecent";
import {
  WallpaperCategoryCard,
  WallpaperColourChip,
  WallpaperCustomColour,
  WallpaperSection,
  WallpaperTile,
  sortStaticBeforeLive,
  type MediaKind,
} from "./wallpaperChooser";

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
          if (ref.source === "builtin") {
            const item = wallpaperCatalogueItems[ref.builtinId];
            found.set(key, item?.kind === "video" ? "video" : "image");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  return { kinds, remember };
}

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
            /* ignore */
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

type ChooserView = "browse" | "my-media" | "gradients" | `cat:${string}`;

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
  const [chooserView, setChooserView] = useState<ChooserView>("browse");
  const [sheetError, setSheetError] = useState("");
  const [pendingRemove, setPendingRemove] = useState<MediaRef | null>(null);
  const [motionOpen, setMotionOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [tintOpen, setTintOpen] = useState(false);
  const [recent, setRecent] = useState<RecentWallpaperEntry[]>([]);
  const { kinds: mediaKinds, remember: rememberMediaKind } = useMediaKinds(
    b.library,
    b.wallpaper,
  );
  const { names: mediaNames, remember: rememberMediaName } = useMediaNames(
    b.library,
  );
  const snapshot = useRef<Background | null>(null);
  const browseScroll = useRef(0);
  const categoryScroll = useRef<Record<string, number>>({});
  const browseFocusId = useRef<string | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const addMediaInput = useRef<HTMLInputElement | null>(null);
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
    setChooserView("browse");
    setRecent(loadRecentWallpapers());
    browseScroll.current = 0;
    setChooserOpen(true);
  };

  const finishDiscard = () => {
    if (snapshot.current) background(snapshot.current);
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
    setChooserView("browse");
    setChooserOpen(false);
  };

  const requestDiscardChooser = async () => {
    const snap = snapshot.current;
    const dirty =
      snap != null &&
      JSON.stringify({ wallpaper: snap.wallpaper, library: snap.library }) !==
        JSON.stringify({ wallpaper: b.wallpaper, library: b.library });
    if (
      !dirty ||
      (await confirm({
        title: "Discard wallpaper changes?",
        description:
          "Close without Use wallpaper? Your previous Settings draft wallpaper will be restored.",
        cancelLabel: "Keep editing",
        actionLabel: "Discard",
      }))
    ) {
      finishDiscard();
    }
  };

  const commitChooser = () => {
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
    setChooserView("browse");
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
    if (!known && ref.source === "asset") {
      try {
        library = prependLibrary(b.library, ref);
      } catch (err) {
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

  const selectBuiltin = (id: string) => {
    const item = wallpaperCatalogueItems[id];
    if (!item) return;
    selectMedia({ source: "builtin", builtinId: id }, item.kind);
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
      setChooserView("my-media");
    } catch (err) {
      setSheetError((err as Error).message);
    } finally {
      onBusy(false);
    }
  };

  const mediaLabel = (ref: MediaRef, kind: MediaKind) => {
    if (ref.source === "builtin") {
      return wallpaperCatalogueItems[ref.builtinId]?.title || ref.builtinId;
    }
    const stored = mediaNames.get(mediaSrc(ref));
    const fallback = kind === "video" ? "Video" : "Photo";
    return stored ? mediaDisplayName(stored, fallback) : fallback;
  };

  const currentMediaName =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? b.wallpaper.media.source === "builtin"
        ? wallpaperCatalogueItems[b.wallpaper.media.builtinId]?.title
        : mediaNames.get(mediaSrc(b.wallpaper.media))
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

  const myMediaLibrary = b.library.filter((ref) => ref.source === "asset");
  const kindForRef = (ref: MediaRef): MediaKind =>
    mediaKindOf(ref) ?? (isActiveVideo(ref) ? "video" : "image");
  const myMediaSorted = sortStaticBeforeLive(myMediaLibrary, kindForRef);
  const recentSorted = sortStaticBeforeLive(recent, (entry) =>
    entry.wallpaper.kind === "video" ? "video" : "image",
  );

  const mediaWallpaper =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? b.wallpaper
      : null;

  /** Poster URL for live tiles when distinct from the video file; else undefined. */
  const livePosterSrc = (ref: MediaRef, thumb?: string): string | undefined => {
    if (ref.source === "builtin") {
      const item = wallpaperCatalogueItems[ref.builtinId];
      if (!item) return undefined;
      const poster = builtinPosterUrl(item);
      const video = builtinMediaUrl(item.id);
      return poster !== video ? poster : undefined;
    }
    if (thumb && thumb !== mediaSrc(ref)) return thumb;
    return undefined;
  };

  const captureBrowseScroll = () => {
    const el = bodyScrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (el) browseScroll.current = el.scrollTop;
  };

  const openCategory = (view: ChooserView, focusId: string) => {
    captureBrowseScroll();
    browseFocusId.current = focusId;
    setChooserView(view);
  };

  const backToBrowse = () => {
    const el = bodyScrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (el && chooserView !== "browse") {
      categoryScroll.current[chooserView] = el.scrollTop;
    }
    setChooserView("browse");
  };

  useEffect(() => {
    if (!chooserOpen) return;
    const el = bodyScrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!el) return;
    if (chooserView === "browse") {
      el.scrollTop = browseScroll.current;
      const id = browseFocusId.current;
      if (id) {
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(`[data-category-card="${id}"]`)
            ?.focus();
        });
      }
    } else {
      el.scrollTop = categoryScroll.current[chooserView] ?? 0;
    }
  }, [chooserView, chooserOpen]);

  const categoryTitle =
    chooserView === "my-media"
      ? "My media"
      : chooserView === "gradients"
        ? "Gradients"
        : chooserView.startsWith("cat:")
          ? wallpaperCatalogueCategories.find(
              (c) => c.id === chooserView.slice(4),
            )?.name || "Category"
          : "Choose wallpaper";

  const addMediaControl = (
    <>
      <Button
        type="button"
        variant="quiet"
        aria-label="Add media"
        onClick={() => addMediaInput.current?.click()}
      >
        <Plus size={16} aria-hidden="true" />
        Add media
      </Button>
      <input
        ref={addMediaInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/webm,video/mp4"
        className="file-picker"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (f) void upload(f);
        }}
      />
    </>
  );

  const myMediaCoverRef =
    myMediaSorted.find((ref) => kindForRef(ref) !== "video") ?? undefined;
  const myMediaCover = myMediaCoverRef ? mediaSrc(myMediaCoverRef) : undefined;

  const renderBrowse = () => (
    <div className="wallpaper-browse">
      <WallpaperSection heading="Colours" label="Colours" compact>
        <div className="wallpaper-colour-row">
          <WallpaperCustomColour
            colour={customColour}
            pressed={b.wallpaper.kind === "solid" && !presetMatch}
            onColour={selectColour}
          />
          <WallpaperColourChip
            name="None"
            colour={theme === "dark" ? "#1a222e" : "#eef1f4"}
            pressed={b.wallpaper.kind === "none"}
            onSelect={() => setWallpaper({ kind: "none" })}
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
        </div>
      </WallpaperSection>

      {recentSorted.length > 0 && (
        <WallpaperSection heading="Recently used" label="Recently used">
          <div className="wallpaper-recent-track">
            {recentSorted.map((entry) => {
              const pressed = wallpaperMatches(b.wallpaper, entry.wallpaper);
              if (entry.wallpaper.kind === "none") {
                return (
                  <WallpaperTile
                    key={entry.key}
                    label={entry.label}
                    pressed={pressed}
                    paint="var(--bg)"
                    onSelect={() => setWallpaper({ kind: "none" })}
                  />
                );
              }
              if (entry.wallpaper.kind === "solid") {
                return (
                  <WallpaperTile
                    key={entry.key}
                    label={entry.label}
                    pressed={pressed}
                    paint={solidBackgroundPaint(entry.wallpaper.colour)}
                    onSelect={() => selectColour(entry.wallpaper.kind === "solid" ? entry.wallpaper.colour : "#a2cbbb")}
                  />
                );
              }
              if (entry.wallpaper.kind === "gradient") {
                const preset = entry.wallpaper.preset;
                return (
                  <WallpaperTile
                    key={entry.key}
                    label={titleCase(preset)}
                    pressed={pressed}
                    paint={gradients[preset]}
                    onSelect={() => selectGradient(preset)}
                  />
                );
              }
              const mediaWallpaper = entry.wallpaper;
              if (mediaWallpaper.kind !== "image" && mediaWallpaper.kind !== "video") {
                return null;
              }
              const kind = mediaWallpaper.kind;
              const videoUrl =
                kind === "video" ? mediaSrc(mediaWallpaper.media) : undefined;
              return (
                <WallpaperTile
                  key={entry.key}
                  label={entry.label}
                  pressed={pressed}
                  kind={kind}
                  src={
                    kind === "video"
                      ? livePosterSrc(mediaWallpaper.media, entry.thumb)
                      : entry.thumb
                  }
                  videoSrc={videoUrl}
                  onSelect={() => selectMedia(mediaWallpaper.media, kind)}
                />
              );
            })}
          </div>
        </WallpaperSection>
      )}

      <WallpaperSection heading="Categories" label="Categories">
        <div className="wallpaper-category-grid">
          <WallpaperCategoryCard
            name="My media"
            coverSrc={myMediaCover}
            empty={!myMediaCover}
            onSelect={() => openCategory("my-media", "My media")}
          />
          <WallpaperCategoryCard
            name="Gradients"
            paint={gradients.ocean}
            onSelect={() => openCategory("gradients", "Gradients")}
          />
          {wallpaperCatalogueCategories.map((cat) => {
            const cover = wallpaperCatalogueItems[cat.coverId];
            const coverSrc = cover
              ? cover.kind === "video"
                ? builtinPosterUrl(cover)
                : builtinMediaUrl(cover.id)
              : undefined;
            return (
              <WallpaperCategoryCard
                key={cat.id}
                name={cat.name}
                coverSrc={coverSrc}
                onSelect={() => openCategory(`cat:${cat.id}`, cat.name)}
              />
            );
          })}
        </div>
      </WallpaperSection>
    </div>
  );

  const renderCategoryGrid = () => {
    if (chooserView === "gradients") {
      return (
        <div className="wallpaper-media-grid">
          {(Object.keys(gradients) as (keyof typeof gradients)[]).map((id) => (
            <WallpaperTile
              key={id}
              label={titleCase(id)}
              pressed={
                b.wallpaper.kind === "gradient" && b.wallpaper.preset === id
              }
              paint={gradients[id]}
              onSelect={() => selectGradient(id)}
            />
          ))}
        </div>
      );
    }
    if (chooserView === "my-media") {
      if (!myMediaLibrary.length) {
        return (
          <div className="wallpaper-empty-media">
            <Text as="p" variant="body">
              Upload photos or muted video loops with Add media. Uploads stay in My media until you Apply settings.
            </Text>
            <Button type="button" variant="primary" onClick={() => addMediaInput.current?.click()}>
              Add media
            </Button>
          </div>
        );
      }
      return (
        <div className="wallpaper-media-grid">
          {myMediaSorted.map((ref) => {
            const kind = kindForRef(ref);
            const url = mediaSrc(ref);
            return (
              <WallpaperTile
                key={url}
                label={mediaLabel(ref, kind)}
                pressed={isActiveImage(ref) || isActiveVideo(ref)}
                kind={kind}
                src={kind === "video" ? livePosterSrc(ref) : url}
                videoSrc={kind === "video" ? url : undefined}
                onSelect={() => selectMedia(ref, kind)}
                onRemove={() => requestRemoveLibraryRef(ref)}
              />
            );
          })}
        </div>
      );
    }
    if (chooserView.startsWith("cat:")) {
      const catId = chooserView.slice(4);
      const cat = wallpaperCatalogueCategories.find((c) => c.id === catId);
      if (!cat) return null;
      const itemIds = sortStaticBeforeLive(
        cat.itemIds,
        (id) => wallpaperCatalogueItems[id]?.kind ?? "image",
      );
      return (
        <div className="wallpaper-media-grid">
          {itemIds.map((id) => {
            const item = wallpaperCatalogueItems[id];
            if (!item) return null;
            const ref: MediaRef = { source: "builtin", builtinId: id };
            const pressed =
              (b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
              mediaRefEqual(b.wallpaper.media, ref);
            const poster = builtinPosterUrl(item);
            const videoUrl =
              item.kind === "video" ? builtinMediaUrl(item.id) : undefined;
            return (
              <WallpaperTile
                key={id}
                label={item.title}
                pressed={pressed}
                kind={item.kind}
                src={
                  item.kind === "video"
                    ? poster !== videoUrl
                      ? poster
                      : undefined
                    : poster
                }
                videoSrc={videoUrl}
                onSelect={() => selectBuiltin(id)}
              />
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="background-settings-stack">
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
                            playback: playback as "loop" | "static",
                          },
                        });
                      }}
                    >
                      <SelectOption value="loop">Loop</SelectOption>
                      <SelectOption value="static">Static</SelectOption>
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
          <Range
            label="Theme overlay"
            tip="Lightens or darkens the background to suit your theme."
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
          title={chooserView === "browse" ? "Choose wallpaper" : categoryTitle}
          placement="bottom"
          backdrop="none"
          className="background-library-dialog"
          close={() => void requestDiscardChooser()}
          onBack={chooserView === "browse" ? undefined : backToBrowse}
          headerActions={addMediaControl}
          footer={
            <div className="background-library-actions">
              <Text as="p" variant="support" className="background-library-actions-note">
                Apply in Settings to save.
              </Text>
              <div className="ui-actions">
                <Button type="button" variant="primary" onClick={commitChooser}>
                  Use wallpaper
                </Button>
              </div>
            </div>
          }
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
          <div ref={bodyScrollRef} className="background-library-scroll-host">
            <ScrollArea
              className="background-library-body-scroll"
              type="auto"
              aria-label={chooserView === "browse" ? "Wallpapers" : categoryTitle}
            >
              {chooserView === "browse" ? renderBrowse() : renderCategoryGrid()}
            </ScrollArea>
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
          footer={
            <Button variant="primary" onClick={() => setMotionOpen(false)}>
              Done
            </Button>
          }
        >
          <SettingsGroup density="compact">
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
          footer={
            <Button variant="primary" onClick={() => setEffectOpen(false)}>
              Done
            </Button>
          }
        >
          <SettingsGroup density="compact">
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
          footer={
            <Button variant="primary" onClick={() => setTintOpen(false)}>
              Done
            </Button>
          }
        >
          <SettingsGroup density="compact">
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
        </Modal>
      )}
    </div>
  );
}

void defaultBackground;
