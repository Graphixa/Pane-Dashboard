import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
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
import { prepareUpload } from "./services/media";
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
  builtinThumbUrl,
  wallpaperCatalogueCategories,
  wallpaperCatalogueItems,
} from "./generated/wallpaperCatalogue";
import {
  filterRecentAgainstLibrary,
  resolveRecentEntries,
  selectRecentWallpaper,
  pruneRecentMediaRef,
  wallpaperMatches,
  type RecentWallpaperEntry,
} from "./wallpaperRecent";
import {
  LiveThumbVideo,
  WallpaperCategoryCard,
  WallpaperColourChip,
  WallpaperCustomColour,
  WallpaperSection,
  WallpaperTile,
  sortStaticBeforeLive,
  useLiveThumbArm,
  usePrefersReducedMotion,
  type MediaKind,
} from "./wallpaperChooser";

/** Catalogue thumb or asset/photo poster URL for Current / Recently selected stills. */
function wallpaperStillUrl(wallpaper: Wallpaper): string | undefined {
  if (wallpaper.kind === "image") {
    if (wallpaper.media.source === "builtin") {
      const item = wallpaperCatalogueItems[wallpaper.media.builtinId];
      return item ? builtinThumbUrl(item) : mediaSrc(wallpaper.media);
    }
    return imageThumbUrl(wallpaper.media);
  }
  if (wallpaper.kind === "video") {
    if (wallpaper.media.source === "builtin") {
      const item = wallpaperCatalogueItems[wallpaper.media.builtinId];
      return item ? builtinThumbUrl(item) : undefined;
    }
    if (wallpaper.media.source === "asset") {
      return imageThumbUrl(wallpaper.media);
    }
  }
  return undefined;
}

function imageThumbUrl(ref: MediaRef): string {
  return ref.source === "asset" ? `${mediaSrc(ref)}/poster` : mediaSrc(ref);
}

// Share in-flight metadata requests between labels, kind detection and existence checks.
// Do not retain responses: opening the chooser must detect files removed on disk.
const metadataRequests = new Map<string, Promise<{ status: number; kind?: MediaKind; name?: string }>>();
function fetchMediaMetadata(id: string) {
  const pending = metadataRequests.get(id);
  if (pending) return pending;
  const request = fetch(`/api/media/meta/${encodeURIComponent(id)}`, { cache: "no-store" })
    .then(async (response) => {
      const body = response.ok ? await response.json() : {};
      return { status: response.status, kind: body.kind as MediaKind | undefined, name: body.name as string | undefined };
    }).finally(() => metadataRequests.delete(id));
  metadataRequests.set(id, request);
  return request;
}

function useMediaMetadata(library: MediaRef[], wallpaper: Wallpaper) {
  const [kinds, setKinds] = useState<Map<string, MediaKind>>(() => new Map());
  const [names, setNames] = useState<Map<string, string>>(() => new Map());
  const rememberKind = (ref: MediaRef, kind: MediaKind) =>
    setKinds((prev) => new Map(prev).set(mediaSrc(ref), kind));
  const rememberName = (ref: MediaRef, name: string) =>
    setNames((prev) => new Map(prev).set(mediaSrc(ref), name.trim()));
  useEffect(() => {
    if (wallpaper.kind === "image" || wallpaper.kind === "video") rememberKind(wallpaper.media, wallpaper.kind);
  }, [wallpaper]);
  useEffect(() => {
    let cancelled = false;
    for (const ref of library) {
      if (ref.source !== "asset") continue;
      void fetchMediaMetadata(ref.assetId).then((meta) => {
        if (cancelled || meta.status !== 200) return;
        if (meta.kind === "image" || meta.kind === "video") rememberKind(ref, meta.kind);
        if (typeof meta.name === "string") rememberName(ref, meta.name);
      }).catch(() => { /* Leave offline entries intact. */ });
    }
    return () => { cancelled = true; };
  }, [library]);
  return { kinds, names, rememberKind, rememberName };
}

/** Filter missing references from the latest draft, never an earlier async snapshot. */
export function withoutMissingMedia(settings: Background, gone: MediaRef[]): Background {
  const missing = (ref: MediaRef) => gone.some((item) => mediaRefEqual(item, ref));
  const w = settings.wallpaper;
  return {
    ...settings,
    library: settings.library.filter((ref) => !missing(ref)),
    wallpaper: (w.kind === "image" || w.kind === "video") && missing(w.media) ? { kind: "none" } : w,
  };
}

type BackgroundUpdate = (update: Partial<Background>) => void;

function titleCase(id: string) {
  return id[0].toUpperCase() + id.slice(1);
}

function assetRefFromPath(path: string): MediaRef | null {
  const m = path.match(/^\/media\/assets\/([A-Za-z0-9_-]{1,128})$/);
  return m ? { source: "asset", assetId: m[1] } : null;
}

/** Current-band live preview: same still-first hover/focus arming as chooser tiles. */
function CurrentLivePreview({
  videoSrc,
  thumbSrc,
  label,
}: {
  videoSrc: string;
  thumbSrc?: string;
  label: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const active = useLiveThumbArm({
    hover,
    focus,
    enabled: !reducedMotion,
  });
  return (
    <div
      className="background-current-preview"
      tabIndex={0}
      aria-label={`${label}, live wallpaper preview`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <div className="ui-aspect-ratio background-current-frame">
        <LiveThumbVideo
          videoSrc={videoSrc}
          thumbSrc={thumbSrc}
          active={active}
        />
      </div>
    </div>
  );
}

function StillPreview({ b, label }: { b: Background; label: string }) {
  const w = b.wallpaper;
  if (w.kind === "video") {
    return (
      <CurrentLivePreview
        videoSrc={mediaSrc(w.media)}
        thumbSrc={wallpaperStillUrl(w)}
        label={label}
      />
    );
  }
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
    const still = wallpaperStillUrl(w) ?? mediaSrc(w.media);
    paint = (
      <img
        className="wallpaper-tile-paint wallpaper-tile-image background-current-image"
        src={still}
        alt=""
        loading="eager"
        fetchPriority="high"
        decoding="async"
        draggable={false}
        aria-hidden="true"
        style={{ objectPosition: w.position }}
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
  recent,
  setRecent,
}: {
  settings: Background;
  theme: "dark" | "light";
  onBusy: (busy: boolean) => void;
  background: BackgroundUpdate;
  onPreviewAdjust?: (active: boolean) => void;
  recent: RecentWallpaperEntry[];
  setRecent: Dispatch<SetStateAction<RecentWallpaperEntry[]>>;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserView, setChooserView] = useState<ChooserView>("browse");
  const [sheetError, setSheetError] = useState("");
  const [pendingRemove, setPendingRemove] = useState<MediaRef | null>(null);
  const [motionOpen, setMotionOpen] = useState(false);
  const [effectOpen, setEffectOpen] = useState(false);
  const [tintOpen, setTintOpen] = useState(false);
  const recentSnapshot = useRef<RecentWallpaperEntry[]>([]);
  const { kinds: mediaKinds, names: mediaNames, rememberKind: rememberMediaKind, rememberName: rememberMediaName } = useMediaMetadata(b.library, b.wallpaper);
  const latest = useRef(b);
  latest.current = b;
  const chooserSession = useRef(0);
  useEffect(() => () => { chooserSession.current++; }, []);
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

  /** Drop library/recent entries whose asset files are gone (avoids “missing media asset” on Apply). */
  const scrubMissingAssets = async (library: MediaRef[], session: number) => {
    const gone: MediaRef[] = [];
    await Promise.all(library.map(async (ref) => {
      if (ref.source !== "asset") return;
      try {
        const meta = await fetchMediaMetadata(ref.assetId);
        if (meta.status === 404) gone.push(ref);
      } catch { /* Offline is not deletion. */ }
    }));
    if (session !== chooserSession.current || !gone.length) return;
    for (const ref of gone) pruneRecentMediaRef(ref);
    const current = latest.current;
    const next = withoutMissingMedia(current, gone);
    latest.current = next;
    background({ library: next.library, wallpaper: next.wallpaper });
    if (snapshot.current) snapshot.current = withoutMissingMedia(snapshot.current, gone);
    setRecent((entries) => filterRecentAgainstLibrary(entries, next.library));
    if (snapshot.current) recentSnapshot.current = filterRecentAgainstLibrary(recentSnapshot.current, snapshot.current.library);
    setSheetError(next.wallpaper !== current.wallpaper
      ? "The current wallpaper file is missing. It was cleared from My media — choose another, then Apply."
      : "Some uploads are no longer on disk and were removed from My media.");
  };

  const openChooser = () => {
    snapshot.current = structuredClone(b);
    setSheetError("");
    setPendingRemove(null);
    setChooserView("browse");
    recentSnapshot.current = structuredClone(recent);
    browseScroll.current = 0;
    setChooserOpen(true);
    void scrubMissingAssets(b.library, ++chooserSession.current);
  };

  const finishDiscard = () => {
    chooserSession.current++;
    if (snapshot.current) background(snapshot.current);
    setRecent(recentSnapshot.current);
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
    setChooserView("browse");
    setChooserOpen(false);
  };

  const requestDiscardChooser = async () => {
    const snap = snapshot.current;
    const dirty = snap != null && (
      JSON.stringify({ wallpaper: snap.wallpaper, library: snap.library }) !==
        JSON.stringify({ wallpaper: b.wallpaper, library: b.library }) ||
      JSON.stringify(recentSnapshot.current) !== JSON.stringify(recent)
    );
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
    chooserSession.current++;
    snapshot.current = null;
    setSheetError("");
    setPendingRemove(null);
    setChooserView("browse");
    setChooserOpen(false);
  };

  const setWallpaper = (wallpaper: Wallpaper, library = b.library) => {
    background({ wallpaper, library });
    setRecent((entries) => selectRecentWallpaper(entries, wallpaper));
  };

  const selectColour = (colour: string) => {
    setWallpaper({ kind: "solid", colour });
  };
  const selectGradient = (preset: keyof typeof gradients) => {
    setWallpaper({ kind: "gradient", preset });
  };
  const selectMedia = (ref: MediaRef, kind: "image" | "video") => {
    setSheetError("");
    if (kind === "image") {
      setWallpaper({ kind: "image", media: ref, position: "center" });
    } else {
      setWallpaper({
        kind: "video",
        media: ref,
        position: "center",
        playback: "loop",
      });
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
    const session = chooserSession.current;
    try {
      const committed = await prepareUpload(file, "background");
      if (session !== chooserSession.current) return;
      const ref = assetRefFromPath(committed.path);
      if (!ref) throw Error("Invalid media response.");
      rememberMediaKind(ref, committed.kind);
      rememberMediaName(ref, committed.name);
      const library = prependLibrary(latest.current.library, ref);
      if (committed.kind === "image") {
        setWallpaper({ kind: "image", media: ref, position: "center" }, library);
      } else {
        setWallpaper(
          { kind: "video", media: ref, position: "center", playback: "loop" },
          library,
        );
      }
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
    setRecent((entries) => filterRecentAgainstLibrary(entries, next));
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
  const recentEntries = filterRecentAgainstLibrary(resolveRecentEntries(recent), b.library);

  const mediaWallpaper =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? b.wallpaper
      : null;

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
    myMediaSorted.find((ref) => mediaKindOf(ref) === "image") ?? undefined;
  const myMediaCover = myMediaCoverRef ? imageThumbUrl(myMediaCoverRef) : undefined;

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

      {recentEntries.length > 0 && (
        <WallpaperSection heading="Recently selected" label="Recently selected">
          <SettingsGroup className="wallpaper-recent-inset">
            <ScrollArea orientation="horizontal" type="always" className="wallpaper-recent-scroll" aria-label="Recently selected wallpapers">
              <div className="wallpaper-recent-track">
                {recentEntries.map((entry) => {
                  const pressed = wallpaperMatches(b.wallpaper, entry.wallpaper);
                  const mediaWallpaper = entry.wallpaper;
                  if (mediaWallpaper.kind !== "image" && mediaWallpaper.kind !== "video") {
                    return null;
                  }
                  const kind = mediaWallpaper.kind;
                  const videoUrl =
                    kind === "video" ? mediaSrc(mediaWallpaper.media) : undefined;
                  // Catalogue thumb or photo URL — never feed a video file into <img>.
                  const thumb =
                    wallpaperStillUrl(mediaWallpaper);
                  return (
                    <WallpaperTile
                      key={entry.key}
                      label={mediaLabel(mediaWallpaper.media, kind)}
                      pressed={pressed}
                      kind={kind}
                      src={thumb}
                      videoSrc={videoUrl}
                      onSelect={() => selectMedia(mediaWallpaper.media, kind)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </SettingsGroup>
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
            const coverSrc = cover ? builtinThumbUrl(cover) : undefined;
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
                src={imageThumbUrl(ref)}
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
            const videoUrl =
              item.kind === "video" ? builtinMediaUrl(item.id) : undefined;
            return (
              <WallpaperTile
                key={id}
                label={item.title}
                pressed={pressed}
                kind={item.kind}
                src={builtinThumbUrl(item)}
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
            <StillPreview b={b} label={wallpaperLabel(b, currentMediaName)} />
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
