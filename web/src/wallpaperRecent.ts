import type { Background, MediaRef, Wallpaper } from "./appearance";
import { mediaRefEqual } from "./appearance";
import {
  builtinThumbUrl,
  wallpaperCatalogueItems,
} from "./generated/wallpaperCatalogue";

export const RECENT_WALLPAPER_KEY = "pane.wallpaper.recent.v1";
export const RECENT_WALLPAPER_MAX = 8;
export const RECENT_WALLPAPER_CHANGED = "pane:wallpaper-recent-changed";

export type RecentWallpaperEntry = {
  key: string;
  wallpaper: Wallpaper;
  label: string;
  thumb?: string;
};

export function wallpaperIdentityKey(wallpaper: Wallpaper): string {
  switch (wallpaper.kind) {
    case "none":
      return "none";
    case "solid":
      return `solid:${wallpaper.colour.toLowerCase()}`;
    case "gradient":
      return `gradient:${wallpaper.preset}`;
    case "image":
    case "video": {
      const m = wallpaper.media;
      if (m.source === "asset") return `${wallpaper.kind}:asset:${m.assetId}`;
      if (m.source === "builtin") return `${wallpaper.kind}:builtin:${m.builtinId}`;
      return `${wallpaper.kind}:url:${m.url}`;
    }
  }
}

export function recentEntryFromWallpaper(
  wallpaper: Wallpaper,
  labelHint?: string,
): RecentWallpaperEntry | null {
  const key = wallpaperIdentityKey(wallpaper);
  if (wallpaper.kind !== "image" && wallpaper.kind !== "video") return null;
  const media = wallpaper.media;
  let label = labelHint || (wallpaper.kind === "video" ? "Video" : "Photo");
  let thumb: string | undefined;
  if (media.source === "asset") {
    thumb = `/media/assets/${media.assetId}/poster`;
  } else if (media.source === "builtin") {
    const item = wallpaperCatalogueItems[media.builtinId];
    label = labelHint || item?.title || media.builtinId;
    thumb = item
      ? builtinThumbUrl(item)
      : `/media/builtin/${encodeURIComponent(media.builtinId)}`;
  } else {
    thumb = media.url;
  }
  if (wallpaper.kind === "image") {
    return {
      key,
      wallpaper: { kind: "image", media, position: "center" },
      label,
      thumb,
    };
  }
  return {
    key,
    wallpaper: { kind: "video", media, position: "center", playback: "loop" },
    label,
    thumb,
  };
}

function validRecentWallpaper(value: unknown): value is Wallpaper {
  if (!value || typeof value !== "object") return false;
  const w = value as Wallpaper;
  if (w.kind === "none") return true;
  if (w.kind === "solid") return /^#[0-9a-f]{6}$/i.test(w.colour);
  if (w.kind === "gradient") return ["dusk", "ocean", "forest", "mist"].includes(w.preset);
  if ((w.kind !== "image" && w.kind !== "video") || !w.media) return false;
  const m = w.media;
  if (m.source === "asset") return typeof m.assetId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(m.assetId);
  if (m.source === "builtin") return typeof m.builtinId === "string";
  if (m.source === "url" && w.kind === "image") {
    try { return ["http:", "https:"].includes(new URL(m.url).protocol); } catch { return false; }
  }
  return false;
}

function readStore(): RecentWallpaperEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_WALLPAPER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is RecentWallpaperEntry => !!e && typeof e === "object" && typeof (e as RecentWallpaperEntry).key === "string" && validRecentWallpaper((e as RecentWallpaperEntry).wallpaper))
      .slice(0, RECENT_WALLPAPER_MAX);
  } catch {
    return [];
  }
}

function writeStore(entries: RecentWallpaperEntry[]) {
  try {
    localStorage.setItem(RECENT_WALLPAPER_KEY, JSON.stringify(entries.slice(0, RECENT_WALLPAPER_MAX)));
  } catch {
    /* quota / private mode — ignore */
  }
  window.dispatchEvent(new Event(RECENT_WALLPAPER_CHANGED));
}

export function loadRecentWallpapers(library?: MediaRef[]): RecentWallpaperEntry[] {
  const resolved = resolveRecentEntries(readStore());
  return library ? filterRecentAgainstLibrary(resolved, library) : resolved;
}

/** Drop unresolvable built-ins; keep assets/colours/gradients. */
export function resolveRecentEntries(entries: RecentWallpaperEntry[]): RecentWallpaperEntry[] {
  return entries.filter((entry) => {
    const w = entry.wallpaper;
    if (w.kind !== "image" && w.kind !== "video") return false;
    if (w.media.source === "builtin") {
      return Boolean(wallpaperCatalogueItems[w.media.builtinId]);
    }
    return true;
  });
}

/** Uploads stay in Recently used only while they remain in the media library. */
export function filterRecentAgainstLibrary(
  entries: RecentWallpaperEntry[],
  library: MediaRef[],
): RecentWallpaperEntry[] {
  return entries.filter((entry) => {
    const w = entry.wallpaper;
    if (w.kind !== "image" && w.kind !== "video") return false;
    if (w.media.source === "builtin") return true;
    return library.some((ref) => mediaRefEqual(ref, w.media));
  });
}

/** Remove matching image/video entries from the recent store (library remove / missing asset). */
export function pruneRecentMediaRef(ref: MediaRef): RecentWallpaperEntry[] {
  const next = readStore().filter((entry) => {
    const w = entry.wallpaper;
    if (w.kind !== "image" && w.kind !== "video") return false;
    return !mediaRefEqual(w.media, ref);
  });
  writeStore(next);
  return resolveRecentEntries(next);
}

/** Persist reconciliation only against a successfully saved library, never a draft. */
export function reconcileRecentWallpapers(library: MediaRef[]) {
  writeStore(filterRecentAgainstLibrary(resolveRecentEntries(readStore()), library));
}

/** Pure draft update: selection moves an image/video to the front without saving. */
export function selectRecentWallpaper(entries: RecentWallpaperEntry[], wallpaper: Wallpaper, labelHint?: string) {
  const entry = recentEntryFromWallpaper(wallpaper, labelHint);
  if (!entry) return entries;
  return [entry, ...resolveRecentEntries(entries).filter((e) => e.key !== entry.key)].slice(0, RECENT_WALLPAPER_MAX);
}

export function recordRecentWallpaper(wallpaper: Wallpaper, labelHint?: string) {
  writeStore(selectRecentWallpaper(readStore(), wallpaper, labelHint));
}

// History remains a browser preference, outside the portable dashboard schema.
// Only a matching successful config save commits the entire Settings history draft.
let pendingRecent: { background: string; entries: RecentWallpaperEntry[] } | null = null;
export function queueRecentWallpaperOnSave(background: Background | undefined, entries: RecentWallpaperEntry[] = []) {
  pendingRecent = background ? { background: JSON.stringify(background), entries: structuredClone(entries) } : null;
}
/** Reopening Settings during a pending save retains the already-applied history. */
export function loadRecentDraft(background: Background | undefined) {
  if (pendingRecent && JSON.stringify(background) === pendingRecent.background) return structuredClone(pendingRecent.entries);
  return loadRecentWallpapers(background?.library ?? []);
}

export function flushPendingRecentWallpaper(saved: Background | undefined) {
  if (!pendingRecent || JSON.stringify(saved) !== pendingRecent.background || !saved) return;
  writeStore(filterRecentAgainstLibrary(resolveRecentEntries(pendingRecent.entries), saved.library));
  pendingRecent = null;
}

export function wallpaperMatches(a: Wallpaper, b: Wallpaper): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "none" && b.kind === "none") return true;
  if (a.kind === "solid" && b.kind === "solid")
    return a.colour.toLowerCase() === b.colour.toLowerCase();
  if (a.kind === "gradient" && b.kind === "gradient") return a.preset === b.preset;
  if (
    (a.kind === "image" || a.kind === "video") &&
    (b.kind === "image" || b.kind === "video")
  ) {
    return a.kind === b.kind && mediaRefEqual(a.media, b.media);
  }
  return false;
}
