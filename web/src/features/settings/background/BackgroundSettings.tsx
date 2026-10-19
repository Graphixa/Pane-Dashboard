import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Range,
  Section,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  Switch,
  useConfirmation,
} from "../../../design/components";
import { prepareUpload } from "../../../services/media";
import {
  accentPresets,
  effectIds,
  effectLabels,
  mediaDisplayName,
  mediaRefEqual,
  mediaSrc,
  motionStyleLabels,
  motionStyles,
  prependLibrary,
  type Background,
  type Effect,
  type EffectId,
  type MediaRef,
  type MotionStyle,
  type Wallpaper,
} from "../../../appearance";
import { getEffectPack } from "../../../effects/registry";
import {
  wallpaperCatalogueCategories,
  wallpaperCatalogueItems,
} from "../../../generated/wallpaperCatalogue";
import {
  filterRecentAgainstLibrary,
  resolveRecentEntries,
  selectRecentWallpaper,
  pruneRecentMediaRef,
  type RecentWallpaperEntry,
} from "../../../wallpaperRecent";
import { sortStaticBeforeLive, type MediaKind } from "../../../wallpaperChooser";
import { CurrentWallpaper } from "./CurrentWallpaper";
import { WallpaperBrowse } from "./WallpaperBrowse";
import { WallpaperCategoryGrid, type ChooserView } from "./WallpaperCategoryGrid";
import { WallpaperChooser } from "./WallpaperChooser";
import { MotionSettingsSheet } from "./MotionSettingsSheet";
import { EffectSettingsSheet } from "./EffectSettingsSheet";
import { TintSettingsSheet } from "./TintSettingsSheet";
import {
  fetchMediaMetadata,
  imageThumbUrl,
  useMediaMetadata,
  withoutMissingMedia,
} from "./useMediaMetadata";

export { withoutMissingMedia } from "./useMediaMetadata";

type BackgroundUpdate = (update: Partial<Background>) => void;

function assetRefFromPath(path: string): MediaRef | null {
  const m = path.match(/^\/media\/assets\/([A-Za-z0-9_-]{1,128})$/);
  return m ? { source: "asset", assetId: m[1] } : null;
}

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


  return (
    <div className="background-settings-stack">
      {confirmation}
      <CurrentWallpaper
        settings={b}
        mediaName={currentMediaName}
        onChangeWallpaper={openChooser}
        onBackground={background}
      />

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

      <WallpaperChooser
        open={chooserOpen}
        view={chooserView}
        categoryTitle={categoryTitle}
        settings={b}
        sheetError={sheetError}
        pendingRemove={pendingRemove}
        bodyScrollRef={bodyScrollRef}
        headerActions={addMediaControl}
        onDiscard={() => void requestDiscardChooser()}
        onBack={backToBrowse}
        onCommit={commitChooser}
        onKeepPending={() => setPendingRemove(null)}
        onConfirmRemove={confirmRemoveLibraryRef}
      >
        {chooserView === "browse" ? (
          <WallpaperBrowse
            settings={b}
            theme={theme}
            customColour={customColour}
            presetMatch={presetMatch}
            solidSelected={solidSelected}
            recentEntries={recentEntries}
            myMediaCover={myMediaCover}
            mediaLabel={mediaLabel}
            onSelectColour={selectColour}
            onSetWallpaper={setWallpaper}
            onSelectMedia={selectMedia}
            onOpenCategory={openCategory}
          />
        ) : (
          <WallpaperCategoryGrid
            settings={b}
            chooserView={chooserView}
            myMediaLibrary={myMediaLibrary}
            myMediaSorted={myMediaSorted}
            kindForRef={kindForRef}
            mediaLabel={mediaLabel}
            isActiveImage={isActiveImage}
            isActiveVideo={isActiveVideo}
            addMediaInput={addMediaInput}
            onSelectGradient={selectGradient}
            onSelectMedia={selectMedia}
            onSelectBuiltin={selectBuiltin}
            onRequestRemove={requestRemoveLibraryRef}
          />
        )}
      </WallpaperChooser>

      {motionOpen && (
        <MotionSettingsSheet
          settings={b}
          onBackground={background}
          onClose={() => setMotionOpen(false)}
        />
      )}

      {effectOpen && b.effect && (
        <EffectSettingsSheet
          settings={b}
          lastEffect={lastEffect.current}
          onBackground={background}
          onClose={() => setEffectOpen(false)}
        />
      )}

      {tintOpen && b.tint && (
        <TintSettingsSheet
          settings={b}
          onBackground={background}
          onClose={() => setTintOpen(false)}
        />
      )}
    </div>
  );
}
