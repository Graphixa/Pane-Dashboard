import { useEffect, useState } from "react";

/** Session cache of video stills (blob URLs) for My media chooser thumbs. */

const THUMB_MAX = 480;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();

export function peekVideoStill(src: string): string | undefined {
  return cache.get(src);
}

function storeVideoStill(src: string, objectUrl: string) {
  const prev = cache.get(src);
  if (prev && prev !== objectUrl) URL.revokeObjectURL(prev);
  cache.set(src, objectUrl);
}

/** Capture a small still once per video URL; reused for idle tiles and hover poster. */
export function ensureVideoStill(src: string): Promise<string | undefined> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(src);
  if (pending) return pending;
  const work = captureVideoStill(src)
    .then((url) => {
      if (url) storeVideoStill(src, url);
      return url;
    })
    .finally(() => {
      inflight.delete(src);
    });
  inflight.set(src, work);
  return work;
}

/** Session-captured still for a video `src` (catalogue thumbs stay at the call site). */
export function useVideoStill(src: string | undefined) {
  const [still, setStill] = useState(() => (src ? peekVideoStill(src) : undefined));

  useEffect(() => {
    if (!src) {
      setStill(undefined);
      return;
    }
    const cached = peekVideoStill(src);
    if (cached) {
      setStill(cached);
      return;
    }
    let cancelled = false;
    ensureVideoStill(src).then((url) => {
      if (!cancelled && url) setStill(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return still;
}

function captureVideoStill(src: string): Promise<string | undefined> {
  if (typeof document === "undefined") return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";

    let settled = false;
    const finish = (url?: string) => {
      if (settled) return;
      settled = true;
      try {
        v.removeAttribute("src");
        v.load();
      } catch {
        /* ignore */
      }
      resolve(url);
    };

    v.addEventListener("error", () => finish());
    v.addEventListener("loadeddata", () => {
      try {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) {
          finish();
          return;
        }
        const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish();
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => finish(blob ? URL.createObjectURL(blob) : undefined),
          "image/webp",
          0.8,
        );
      } catch {
        finish();
      }
    });

    v.src = src;
  });
}

/** Test helper — clears session stills. */
export function clearVideoStillCache() {
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
  inflight.clear();
}

/** Test helper — seed a still without capturing. */
export function seedVideoStillForTest(src: string, objectUrl: string) {
  storeVideoStill(src, objectUrl);
}
