import { useEffect, useState, type CSSProperties } from "react";
import {
  defaultBackground,
  gradients,
  imageReference,
  type Background as BackgroundSettings,
} from "./appearance";

export default function Background({
  settings = defaultBackground,
}: {
  settings?: BackgroundSettings;
}) {
  const [failed, setFailed] = useState(false),
    [hidden, setHidden] = useState(false);
  useEffect(() => setFailed(false), [settings.image]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const b = settings,
    animated = b.kind === "waves" || b.kind === "aurora";
  const activeImage =
    b.kind === "image" && imageReference(b.image) && b.image && !failed;
  return (
    <div
      aria-hidden="true"
      className={`scene scene-${b.kind} ${!b.motion || hidden ? "motion-paused" : ""}`}
      style={
        {
          "--motion-strength": b.intensity / 100,
          "--motion-duration": `${70 - b.intensity * 0.4}s`,
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
        <div className="scene-dimming" style={{ opacity: b.dimming / 100 }} />
      )}
    </div>
  );
}
