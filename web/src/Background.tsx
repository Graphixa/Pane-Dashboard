import { useEffect, useState, type CSSProperties } from "react";
import {
  creativeTintPaint,
  defaultBackground,
  gradients,
  mediaSrc,
  motionDurationSeconds,
  normaliseBackground,
  solidBackgroundPaint,
  themeOverlayPaint,
  type Background as BackgroundSettings,
} from "./appearance";
import EffectLayer from "./effects/EffectLayer";
import VideoWallpaper from "./VideoWallpaper";

export default function Background({
  settings = defaultBackground,
  theme = "dark",
  paletteBackground,
}: {
  settings?: BackgroundSettings;
  theme?: "dark" | "light";
  paletteBackground?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const b = normaliseBackground(settings);
  const wall = b.wallpaper;
  const targetDuration = motionDurationSeconds(b.photoMotion.intensity);
  const photoMotion =
    wall.kind === "image" &&
    b.photoMotion.style !== "none" &&
    !hidden &&
    !reducedMotion;
  const effectPaused = hidden || reducedMotion;
  const videoPaused = hidden || reducedMotion;

  const [playDuration, setPlayDuration] = useState(targetDuration);
  const mediaKey =
    wall.kind === "image" || wall.kind === "video"
      ? mediaSrc(wall.media)
      : "";
  useEffect(() => setFailed(false), [mediaKey]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    setPlayDuration(targetDuration);
  }, [b.photoMotion.style, wall.kind]);
  useEffect(() => {
    if (!photoMotion) {
      setPlayDuration(targetDuration);
      return;
    }
    const timer = window.setTimeout(() => setPlayDuration(targetDuration), 400);
    return () => window.clearTimeout(timer);
  }, [targetDuration, photoMotion]);

  const basePaint =
    wall.kind === "none"
      ? "var(--bg)"
      : wall.kind === "solid"
        ? solidBackgroundPaint(wall.colour)
        : wall.kind === "gradient"
          ? (gradients[wall.preset] ?? gradients.dusk)
          : "var(--bg)";

  const motionClass =
    wall.kind === "image" ? `motion-${b.photoMotion.style}` : "motion-none";

  return (
    <div
      aria-hidden="true"
      className={`scene scene-bg-${wall.kind} ${motionClass}${photoMotion ? "" : " motion-paused"}`}
      style={
        {
          "--motion-strength": b.photoMotion.intensity / 100,
          "--motion-duration": `${playDuration}s`,
          background: basePaint,
        } as CSSProperties
      }
    >
      <div className="scene-base" style={{ background: basePaint }} />
      {(wall.kind === "image" || wall.kind === "video") && !failed && (
        <div className="scene-stage scene-photo-host">
          {wall.kind === "image" && (
            <img
              className="scene-image"
              src={mediaSrc(wall.media)}
              alt=""
              referrerPolicy="no-referrer"
              style={{ objectPosition: wall.position }}
              onError={() => setFailed(true)}
            />
          )}
          {wall.kind === "video" && (
            <VideoWallpaper
              src={mediaSrc(wall.media)}
              position={wall.position}
              playback={wall.playback}
              paused={videoPaused}
            />
          )}
        </div>
      )}
      {b.tint && b.tint.opacity > 0 && (
        <div
          className="scene-tint"
          style={{ background: creativeTintPaint(b.tint) }}
        />
      )}
      {b.effect && (
        <EffectLayer effect={b.effect} paused={effectPaused} />
      )}
      {b.themeOverlayOpacity > 0 && (
        <div
          className="scene-theme-overlay"
          style={{
            background: themeOverlayPaint(
              theme,
              b.themeOverlayOpacity,
              paletteBackground,
            ),
          }}
        />
      )}
    </div>
  );
}
