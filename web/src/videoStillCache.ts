import { useSyncExternalStore } from "react";

// Capture only from the preview that is already playing. Idle tiles never fetch video.
const cache = new Map<string, string>();
const pending = new Set<string>();
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
export function capturePlayingVideoStill(src: string, video: HTMLVideoElement) {
  if (cache.has(src) || pending.has(src) || !video.videoWidth || !video.videoHeight) return;
  const epoch = generation;
  pending.add(src);
  try {
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) { pending.delete(src); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (epoch !== generation) return;
      pending.delete(src);
      if (blob) storeVideoStill(src, URL.createObjectURL(blob));
    }, "image/webp", 0.8);
  } catch { pending.delete(src); }
}
export function clearVideoStillCache() {
  generation++;
  for (const url of cache.values()) URL.revokeObjectURL(url);
  cache.clear();
  pending.clear();
  notify();
}
export function seedVideoStillForTest(src: string, url: string) { storeVideoStill(src, url); }
