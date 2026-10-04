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
  return (
    <div
      aria-hidden="true"
      className={`scene scene-${b.kind} ${!b.motion || hidden ? "motion-paused" : ""}`}
      style={
        {
          "--motion-strength": b.intensity / 100,
          "--motion-duration":
            b.kind === "image"
              ? `${80 - b.intensity * 0.74}s`
              : `${70 - b.intensity * 0.4}s`,
          background:
            b.kind === "none"
              ? "var(--bg)"
              : (gradients[b.preset] ?? gradients.dusk),
        } as CSSProperties
      }
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
      {animated && (
        <div className="scene-motion">
          <i />
          <i />
          <i />
        </div>
      )}
      {b.kind !== "none" && (
        <div
          className="scene-overlay"
          style={{ background: overlayBackground(b) }}
        />
      )}
    </div>
  );
}
