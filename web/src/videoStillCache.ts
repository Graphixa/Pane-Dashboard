import { useSyncExternalStore } from "react";

// Session overlay while durable posters load. Idle tiles never fetch video.
const cache = new Map<string, string>();
const pending = new Set<string>();
const posterPutAttempted = new Set<string>();
const listeners = new Set<() => void>();
let generation = 0;
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function peekVideoStill(src: string) { return cache.get(src); }

function storeVideoStill(src: string, url: string) {
  const previous = cache.get(src);
  if (previous && previous !== url) URL.revokeObjectURL(previous);
  cache.set(src, url);
  // Bound memory even when several libraries are used during one session.
  if (cache.size > 32) {
    const oldest = cache.keys().next().value!;
    URL.revokeObjectURL(cache.get(oldest)!);
    cache.delete(oldest);
  }
  notify();
}

export function useVideoStill(src: string | undefined) {
  return useSyncExternalStore(subscribe, () => src ? cache.get(src) : undefined, () => undefined);
}

function frameToJpegBlob(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) return Promise.resolve(null);
  const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
  });
}

/** Asset id from `/media/assets/{id}` (optional `/poster` suffix ignored). */
export function assetIdFromMediaPath(path: string): string | undefined {
  const m = path.match(/^\/media\/assets\/([A-Za-z0-9_-]{1,128})(?:\/poster)?$/);
  return m?.[1];
}

/** Persist a client-captured still for a committed video asset. */
export async function putVideoPoster(assetId: string, blob: Blob): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) return false;
  try {
    const res = await fetch(`/api/media/poster/${encodeURIComponent(assetId)}`, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

function putPosterOnce(videoSrc: string, blob: Blob) {
  const id = assetIdFromMediaPath(videoSrc);
  if (!id || posterPutAttempted.has(id)) return;
  posterPutAttempted.add(id);
  void putVideoPoster(id, blob);
}

/**
 * Capture a ≤480px JPEG from a local video File (Add media).
 * Soft-fails to null so upload can still complete.
 */
export function extractVideoStillFromFile(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    video.addEventListener("error", () => finish(null), { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        const capture = () => {
          void frameToJpegBlob(video).then(finish);
        };
        const duration = video.duration;
        const target =
          Number.isFinite(duration) && duration > 0
            ? Math.min(0.5, Math.max(0, duration - 0.05))
            : 0;
        if (target <= 0) {
          capture();
          return;
        }
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          capture();
        };
        video.addEventListener("seeked", onSeeked);
        try {
          video.currentTime = target;
        } catch {
          capture();
        }
      },
      { once: true },
    );
    video.src = objectUrl;
  });
}

/** Seed the session cache after a successful upload still extract. */
export function seedVideoStillFromBlob(src: string, blob: Blob) {
  storeVideoStill(src, URL.createObjectURL(blob));
}

export function capturePlayingVideoStill(src: string, video: HTMLVideoElement) {
  if (cache.has(src) || pending.has(src) || !video.videoWidth || !video.videoHeight) {
    // Still may already be in session cache; durable poster may still be missing.
    if (cache.has(src) && !pending.has(src)) {
      const id = assetIdFromMediaPath(src);
      if (id && !posterPutAttempted.has(id)) {
        void frameToJpegBlob(video).then((blob) => {
          if (blob) putPosterOnce(src, blob);
        });
      }
    }
    return;
  }
  const epoch = generation;
  pending.add(src);
  void frameToJpegBlob(video)
    .then((blob) => {
      if (epoch !== generation) return;
      pending.delete(src);
      if (!blob) return;
      storeVideoStill(src, URL.createObjectURL(blob));
      putPosterOnce(src, blob);
    })
    .catch(() => {
      if (epoch === generation) pending.delete(src);
    });
}

export function clearVideoStillCache() {
  generation++;
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
  pending.clear();
  posterPutAttempted.clear();
  notify();
}

export function seedVideoStillForTest(src: string, url: string) { storeVideoStill(src, url); }
