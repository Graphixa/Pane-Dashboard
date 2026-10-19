import { useState, type ReactNode } from "react";
import {
  Button,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  Text,
} from "../../../design/components";
import {
  gradients,
  mediaSrc,
  solidBackgroundPaint,
  wallpaperLabel,
  type Background,
} from "../../../appearance";
import {
  LiveThumbVideo,
  useLiveThumbArm,
  usePrefersReducedMotion,
} from "../../../wallpaperChooser";
import { wallpaperStillUrl } from "./useMediaMetadata";

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
    paint = (
      <span
        className="background-swatch-paint"
        style={{ background: "var(--bg)" }}
      />
    );
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

export type CurrentWallpaperProps = {
  settings: Background;
  mediaName?: string;
  onChangeWallpaper: () => void;
  onBackground: (update: Partial<Background>) => void;
};

/** Compact Current band: still/live preview, name, Change wallpaper, Position/Playback. */
export function CurrentWallpaper({
  settings: b,
  mediaName,
  onChangeWallpaper,
  onBackground,
}: CurrentWallpaperProps) {
  const label = wallpaperLabel(b, mediaName);
  const mediaWallpaper =
    b.wallpaper.kind === "image" || b.wallpaper.kind === "video"
      ? b.wallpaper
      : null;

  return (
    <SettingsGroup className="background-current-group">
      <SettingsRow>
        <div className="background-current">
          <StillPreview b={b} label={label} />
          <div className="background-current-meta">
            <Text
              as="span"
              variant="support"
              className="background-current-eyebrow"
            >
              Currently set
            </Text>
            <Text as="span" variant="label" className="background-current-name">
              {label}
            </Text>
            <Button
              type="button"
              className="background-current-change"
              onClick={onChangeWallpaper}
            >
              Change wallpaper
            </Button>
          </div>
          {mediaWallpaper && (
            <div className="background-current-controls">
              <div className="background-current-control">
                <Text
                  as="span"
                  variant="support"
                  className="background-current-control-label"
                >
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
                    onBackground({
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
                  <Text
                    as="span"
                    variant="support"
                    className="background-current-control-label"
                  >
                    Playback
                  </Text>
                  <Select
                    aria-label="Playback"
                    value={b.wallpaper.playback}
                    onValueChange={(playback) => {
                      if (b.wallpaper.kind !== "video") return;
                      onBackground({
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
  );
}
