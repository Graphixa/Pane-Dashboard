import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  ColourField,
  IconButton,
  Modal,
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

function assetRefFromPath(path: string): MediaRef | null {
  const m = path.match(/^\/media\/assets\/([A-Za-z0-9_-]{1,128})$/);
  return m ? { source: "asset", assetId: m[1] } : null;
}

function StillPreview({ b }: { b: Background }) {
  const w = b.wallpaper;
  if (w.kind === "solid") {
    return (
      <span
        className="wallpaper-current-swatch"
        style={{ background: solidBackgroundPaint(w.colour) }}
      />
    );
  }
  if (w.kind === "gradient") {
    return (
      <span
        className="wallpaper-current-swatch"
        style={{ background: gradients[w.preset] }}
      />
    );
  }
  if (w.kind === "image" || w.kind === "video") {
    return (
      <span
        className="wallpaper-current-swatch wallpaper-current-media"
        style={{
          backgroundImage: `url(${mediaSrc(w.media)})`,
          backgroundSize: "cover",
          backgroundPosition: w.position,
        }}
      />
    );
  }
  return <span className="wallpaper-current-swatch" style={{ background: "var(--bg)" }} />;
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

  const imageLibrary = b.library.filter((r) => r.source === "url" || r.source === "asset");
  // Library does not store kind; tiles assume image unless active video.
  const isActive = (ref: MediaRef) =>
    (b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
    mediaRefEqual(b.wallpaper.media, ref);

  return (
    <>
      {confirmation}
      <SettingsGroup>
        <div className="wallpaper-current">
          <StillPreview b={b} />
          <div className="wallpaper-current-copy">
            <Text variant="label">Currently set</Text>
            <Text variant="body">{wallpaperLabel(b)}</Text>
          </div>
          <Button type="button" onClick={openChooser}>
            Change wallpaper
          </Button>
        </div>
      </SettingsGroup>

      {(b.wallpaper.kind === "image" || b.wallpaper.kind === "video") && (
        <SettingsGroup>
          <SettingsRow label="Position">
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
                      style: lastMotion.current === "none" ? "ken-burns" : lastMotion.current,
                      intensity: b.photoMotion.intensity || 40,
                    },
                  })
                }
              >
                <Plus size={16} aria-hidden /> Add motion
              </Button>
            ) : (
              <div className="wallpaper-row-actions">
                <Button type="button" onClick={() => setMotionOpen(true)}>
                  Customise
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    background({ photoMotion: { style: "none", intensity: b.photoMotion.intensity } })
                  }
                >
                  Remove
                </Button>
              </div>
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
            <div className="wallpaper-row-actions">
              <Button type="button" onClick={() => setEffectOpen(true)}>
                Customise
              </Button>
              <Button type="button" onClick={() => background({ effect: undefined })}>
                Remove
              </Button>
            </div>
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
            <div className="wallpaper-row-actions">
              <Button type="button" onClick={() => setTintOpen(true)}>
                Customise
              </Button>
              <Button type="button" onClick={() => background({ tint: undefined })}>
                Remove
              </Button>
            </div>
          )}
        </SettingsRow>

        <SettingsRow
          label="Theme overlay"
          hint="Lightens or darkens the background to suit your theme."
        >
          <Range
            label="Opacity" min={0} max={80} unit="%" value={b.themeOverlayOpacity} change={(themeOverlayOpacity) => background({ themeOverlayOpacity })}
          />
        </SettingsRow>
      </SettingsGroup>

      {chooserOpen && (
        <Modal
          title="Choose wallpaper"
          placement="bottom"
          close={discardChooser}
          
        >
          <div className="wallpaper-chooser-actions"><Button type="button" variant="primary" onClick={commitChooser}>Done</Button></div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "static" | "animated")}>
            <TabsList aria-label="Wallpaper type">
              <TabsTrigger value="static">Static</TabsTrigger>
              <TabsTrigger value="animated">Animated</TabsTrigger>
            </TabsList>
            <TabsContent value="static">
              <ScrollArea className="wallpaper-chooser-scroll" aria-label="Static wallpapers">
                <Text as="h4" variant="label">
                  Colours
                </Text>
                <div className="colour-tile-row" role="group" aria-label="Colours">
                  <ColourField
                    label="Custom colour"
                    colour={b.wallpaper.kind === "solid" ? b.wallpaper.colour : "#a2cbbb"} onColour={selectColour}
                  />
                  {accentPresets[theme].map((p) => (
                    <Button
                      key={p.colour}
                      type="button"
                      className="colour-tile"
                      aria-pressed={
                        b.wallpaper.kind === "solid" &&
                        b.wallpaper.colour.toLowerCase() === p.colour.toLowerCase()
                      }
                      aria-label={p.name}
                      onClick={() => selectColour(p.colour)}
                      style={{ background: solidBackgroundPaint(p.colour) }}
                    />
                  ))}
                </div>
                <Text as="h4" variant="label">
                  Gradients
                </Text>
                <div className="colour-tile-row" role="group" aria-label="Gradients">
                  {(Object.keys(gradients) as (keyof typeof gradients)[]).map(
                    (id) => (
                      <Button
                        key={id}
                        type="button"
                        className="colour-tile"
                        aria-pressed={
                          b.wallpaper.kind === "gradient" &&
                          b.wallpaper.preset === id
                        }
                        aria-label={id}
                        onClick={() => selectGradient(id)}
                        style={{ background: gradients[id] }}
                      />
                    ),
                  )}
                </div>
                <Text as="h4" variant="label">
                  My media
                </Text>
                <div className="wallpaper-library-row">
                  <label className="wallpaper-upload-tile">
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="file-picker"
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (f) void upload(f);
                      }}
                    />
                  </label>
                  {imageLibrary.map((ref) => (
                    <Button
                      key={mediaSrc(ref)}
                      type="button"
                      className="wallpaper-library-tile"
                      aria-pressed={isActive(ref)}
                      onClick={() => selectMedia(ref, "image")}
                      style={{
                        backgroundImage: `url(${mediaSrc(ref)})`,
                        backgroundSize: "cover",
                      }}
                    >
                      <IconButton
                        label="Remove from library"
                        className="wallpaper-library-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = b.library.filter((x) => !mediaRefEqual(x, ref));
                          if (isActive(ref)) {
                            background({
                              library: next,
                              wallpaper: { kind: "none" },
                            });
                          } else background({ library: next });
                        }}
                      >
                        <Trash2 size={14} aria-hidden />
                      </IconButton>
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => setWallpaper({ kind: "none" })}
                >
                  None
                </Button>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="animated">
              <ScrollArea className="wallpaper-chooser-scroll" aria-label="Animated wallpapers">
                <Text as="h4" variant="label">
                  Videos
                </Text>
                <div className="wallpaper-library-row">
                  <label className="wallpaper-upload-tile">
                    <span>Upload video</span>
                    <input
                      type="file"
                      accept="video/webm,video/mp4"
                      className="file-picker"
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (f) void upload(f);
                      }}
                    />
                  </label>
                  {b.library.map((ref) => (
                    <Button
                      key={`v-${mediaSrc(ref)}`}
                      type="button"
                      className="wallpaper-library-tile"
                      aria-pressed={
                        b.wallpaper.kind === "video" &&
                        mediaRefEqual(b.wallpaper.media, ref)
                      }
                      onClick={() => selectMedia(ref, "video")}
                    >
                      Video
                    </Button>
                  ))}
                </div>
                <Text variant="support">
                  Built-in video loops will appear here once catalogue artwork is selected.
                </Text>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Modal>
      )}

      {motionOpen && (
        <Modal title="Motion" placement="bottom" close={() => setMotionOpen(false)}>
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
            <SettingsRow label="Intensity">
              <Range
                label="Intensity" min={0} max={100} unit="%" value={b.photoMotion.intensity} change={(intensity) => background({ photoMotion: { ...b.photoMotion, intensity } })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Modal>
      )}

      {effectOpen && b.effect && (
        <Modal title="Effect" placement="bottom" close={() => setEffectOpen(false)}>
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
                <SettingsRow key={c.key} label={c.label}>
                  <ColourField
                    label={c.label}
                    colour={String(b.effect?.params[c.key] ?? c.default)} onColour={(colour) =>
                      background({
                        effect: {
                          id: b.effect!.id,
                          params: { ...b.effect!.params, [c.key]: colour },
                        },
                      })
                    }
                  />
                </SettingsRow>
              ) : (
                <SettingsRow key={c.key} label={c.label}>
                  <Range
                    label={c.label} min={c.min} max={c.max} value={Number(b.effect?.params[c.key] ?? c.default)} change={(n) =>
                      background({
                        effect: {
                          id: b.effect!.id,
                          params: { ...b.effect!.params, [c.key]: n },
                        },
                      })
                    }
                  />
                </SettingsRow>
              ),
            )}
          </SettingsGroup>
        </Modal>
      )}

      {tintOpen && b.tint && (
        <Modal title="Tint" placement="bottom" close={() => setTintOpen(false)}>
          <SettingsGroup>
            <SettingsRow label="Colour">
              <ColourField
                label="Tint colour"
                colour={b.tint.colour} onColour={(colour) =>
                  background({ tint: { ...b.tint!, colour } })
                }
              />
            </SettingsRow>
            <SettingsRow label="Opacity">
              <Range
                label="Opacity" min={0} max={80} unit="%" value={b.tint.opacity} change={(opacity) => background({ tint: { ...b.tint!, opacity } })}
              />
            </SettingsRow>
          </SettingsGroup>
        </Modal>
      )}
    </>
  );
}

// Keep defaultBackground import used for type parity in tests that re-export.
void defaultBackground;
