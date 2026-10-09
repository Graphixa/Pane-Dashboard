import { useEffect, useRef, useState } from "react";

export default function VideoWallpaper({
  src,
  poster,
  position,
  playback,
  paused,
}: {
  src: string;
  poster?: string;
  position: "center" | "top" | "bottom";
  playback: "loop" | "static";
  paused: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playback === "static" || paused || failed) {
      v.pause();
      return;
    }
    v.muted = true;
    const play = v.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => setFailed(true));
    }
  }, [src, playback, paused, failed]);

  if (failed || playback === "static") {
    if (poster) {
      return (
        <img
          className="scene-image"
          src={poster}
          alt=""
          referrerPolicy="no-referrer"
          style={{ objectPosition: position }}
        />
      );
    }
    if (failed) return null;
  }

  return (
    <video
      ref={ref}
      className="scene-image scene-video"
      src={src}
      poster={poster}
      muted
      playsInline
      loop={playback === "loop"}
      preload="metadata"
      style={{ objectPosition: position }}
      onError={() => setFailed(true)}
    />
  );
}
