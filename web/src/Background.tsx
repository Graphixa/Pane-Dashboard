import { useEffect, useState, type CSSProperties } from "react";
import {
  defaultBackground,
  gradients,
  imageReference,
  migrateBackground,
  overlayBackground,
  type Background as BackgroundSettings,
} from "./appearance";

export default function Background({
  settings = defaultBackground,
  theme = "dark",
}: {
  settings?: BackgroundSettings & { dimming?: number };
  theme?: "dark" | "light";
}) {
  const [failed, setFailed] = useState(false),
    [hidden, setHidden] = useState(false);
  const b = migrateBackground(settings, theme);
  useEffect(() => setFailed(false), [b.image]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const animated = b.kind === "waves" || b.kind === "aurora";
  const activeImage =
    b.kind === "image" && imageReference(b.image) && b.image && !failed;
  const paused = b.motionStyle === "none" || !b.motion || hidden;
  const paint =
    b.kind === "none" ? "var(--bg)" : (gradients[b.preset] ?? gradients.dusk);
  return (
    <div
      aria-hidden="true"
      className={`scene scene-${b.kind} motion-${b.motionStyle}${paused ? " motion-paused" : ""}`}
      style={
        {
          "--motion-strength": b.intensity / 100,
          "--motion-duration": `${80 - b.intensity * 0.74}s`,
          background: paint,
        } as CSSProperties
      }
    >
      <div className="scene-stage" style={{ background: paint }}>
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
        {animated && (
          <div className="scene-motion">
            <i />
            <i />
            <i />
          </div>
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
