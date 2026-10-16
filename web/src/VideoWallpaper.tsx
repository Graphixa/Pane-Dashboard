import { useEffect, useRef, useState } from "react";

export default function VideoWallpaper({
  src,
  position,
  playback,
  paused,
}: {
  src: string;
  position: "center" | "top" | "bottom";
  playback: "loop" | "static";
  paused: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const holdStill = playback === "static" || paused;

  useEffect(() => setFailed(false), [src]);

  useEffect(() => {
    const v = ref.current;
    if (!v || failed) return;
    if (holdStill) {
      v.pause();
      return;
    }
    v.muted = true;
    const play = v.play();
    if (play && typeof play.catch === "function") {
      // Autoplay can reject without a bad file — keep the paused frame visible.
      play.catch(() => {
        v.pause();
      });
    }
  }, [src, holdStill, failed]);

  if (failed) return null;

  return (
    <video
      ref={ref}
      className="scene-image scene-video"
      src={src}
      muted
      playsInline
      loop={playback === "loop"}
      preload="auto"
      style={{ objectPosition: position }}
      onError={() => setFailed(true)}
      onLoadedData={(event) => {
        const v = event.currentTarget;
        if (!holdStill) return;
        try {
          if (v.currentTime < 0.05) v.currentTime = 0.05;
        } catch {
          /* ignore */
        }
        v.pause();
      }}
    />
  );
}
