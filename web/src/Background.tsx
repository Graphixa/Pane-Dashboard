import { useEffect, useState, type CSSProperties } from "react";
import {
  defaultBackground,
  gradients,
  imageReference,
  migrateBackground,
  motionDurationSeconds,
  overlayBackground,
  solidBackgroundPaint,
  type Background as BackgroundSettings,
} from "./appearance";
import DynamicScene from "./dynamic/DynamicScene";

export default function Background({
  settings = defaultBackground,
  theme = "dark",
}: {
  settings?: BackgroundSettings & { dimming?: number };
  theme?: "dark" | "light";
}) {
  const [failed, setFailed] = useState(false),
    [hidden, setHidden] = useState(false),
    [reduceTransparency, setReduceTransparency] = useState(false);
  const b = migrateBackground(settings, theme);
  const targetDuration = motionDurationSeconds(b.intensity);
  const paused =
    b.motionStyle === "none" || !b.motion || hidden || reduceTransparency;
  const dynamicPaused = hidden || reduceTransparency;
  // Keep duration stable while playing so intensity ticks do not restart CSS animations.
  const [playDuration, setPlayDuration] = useState(targetDuration);
  useEffect(() => setFailed(false), [b.image]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceTransparency(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    setPlayDuration(targetDuration);
  }, [b.motionStyle, b.kind]);
  useEffect(() => {
    if (paused) {
      setPlayDuration(targetDuration);
      return;
    }
    const timer = window.setTimeout(() => setPlayDuration(targetDuration), 400);
    return () => window.clearTimeout(timer);
  }, [targetDuration, paused]);
  const isDynamic = b.kind === "dynamic" && !!b.dynamicId;
  const activeImage =
    b.kind === "image" && imageReference(b.image) && b.image && !failed;
  const paletteKey =
    isDynamic && typeof b.dynamicParams?.palette === "string"
      ? b.dynamicParams.palette
      : b.preset;
  const gradientPaint =
    gradients[paletteKey as keyof typeof gradients] ?? gradients.dusk;
  const paint =
    b.kind === "none"
      ? "var(--bg)"
      : b.kind === "solid"
        ? solidBackgroundPaint(b.colour)
        : b.kind === "dynamic"
          ? gradientPaint
          : (gradients[b.preset] ?? gradients.dusk);
  return (
    <div
      aria-hidden="true"
      className={`scene scene-bg-${b.kind}${isDynamic ? " scene-dynamic-host" : ""} motion-${b.motionStyle}${paused && !isDynamic ? " motion-paused" : ""}${dynamicPaused && isDynamic ? " motion-paused" : ""}`}
      data-wallpaper-tint=""
      style={
        {
          "--motion-strength": b.intensity / 100,
          "--motion-duration": `${playDuration}s`,
          background: b.kind === "dynamic" ? "var(--bg)" : paint,
        } as CSSProperties
      }
    >
      <div
        className="scene-stage"
        data-wallpaper-tint=""
        style={{ background: b.kind === "dynamic" ? "transparent" : paint }}
      >
        {activeImage && (
          <img
            className="scene-image"
            src={b.image}
            alt=""
            referrerPolicy="no-referrer"
            style={{ objectPosition: b.position }}
            onError={() => setFailed(true)}
          />
        )}
        {isDynamic && b.dynamicId && (
          <DynamicScene
            dynamicId={b.dynamicId}
            params={b.dynamicParams ?? {}}
            paused={dynamicPaused}
            gradientPaint={gradientPaint}
          />
        )}
      </div>
      {b.kind !== "none" && (
        <div
          className="scene-overlay"
          style={{ background: overlayBackground(b) }}
        />
      )}
    </div>
  );
}
