import { useEffect, useState } from "react";
import {
  mediaRefEqual,
  mediaSrc,
  type Background,
  type MediaRef,
  type Wallpaper,
} from "../../../appearance";
import type { MediaKind } from "../../../wallpaperChooser";
import {
  builtinThumbUrl,
  wallpaperCatalogueItems,
} from "../../../generated/wallpaperCatalogue";

/** Catalogue thumb or asset/photo poster URL for Current / Recently selected stills. */
export function wallpaperStillUrl(wallpaper: Wallpaper): string | undefined {
  if (wallpaper.kind === "image") {
    if (wallpaper.media.source === "builtin") {
      const item = wallpaperCatalogueItems[wallpaper.media.builtinId];
      return item ? builtinThumbUrl(item) : mediaSrc(wallpaper.media);
    }
    return imageThumbUrl(wallpaper.media);
  }
  if (wallpaper.kind === "video") {
    if (wallpaper.media.source === "builtin") {
      const item = wallpaperCatalogueItems[wallpaper.media.builtinId];
      return item ? builtinThumbUrl(item) : undefined;
    }
    if (wallpaper.media.source === "asset") {
      return imageThumbUrl(wallpaper.media);
    }
  }
  return undefined;
}

export function imageThumbUrl(ref: MediaRef): string {
  return ref.source === "asset" ? `${mediaSrc(ref)}/poster` : mediaSrc(ref);
}

// Share in-flight metadata requests between labels, kind detection and existence checks.
// Do not retain responses: opening the chooser must detect files removed on disk.
const metadataRequests = new Map<
  string,
  Promise<{ status: number; kind?: MediaKind; name?: string }>
>();

export function fetchMediaMetadata(id: string) {
  const pending = metadataRequests.get(id);
  if (pending) return pending;
  const request = fetch(`/api/media/meta/${encodeURIComponent(id)}`, {
    cache: "no-store",
  })
    .then(async (response) => {
      const body = response.ok ? await response.json() : {};
      return {
        status: response.status,
        kind: body.kind as MediaKind | undefined,
        name: body.name as string | undefined,
      };
    })
    .finally(() => metadataRequests.delete(id));
  metadataRequests.set(id, request);
  return request;
}

export function useMediaMetadata(library: MediaRef[], wallpaper: Wallpaper) {
  const [kinds, setKinds] = useState<Map<string, MediaKind>>(() => new Map());
  const [names, setNames] = useState<Map<string, string>>(() => new Map());
  const rememberKind = (ref: MediaRef, kind: MediaKind) =>
    setKinds((prev) => new Map(prev).set(mediaSrc(ref), kind));
  const rememberName = (ref: MediaRef, name: string) =>
    setNames((prev) => new Map(prev).set(mediaSrc(ref), name.trim()));
  useEffect(() => {
    if (wallpaper.kind === "image" || wallpaper.kind === "video")
      rememberKind(wallpaper.media, wallpaper.kind);
  }, [wallpaper]);
  useEffect(() => {
    let cancelled = false;
    for (const ref of library) {
      if (ref.source !== "asset") continue;
      void fetchMediaMetadata(ref.assetId)
        .then((meta) => {
          if (cancelled || meta.status !== 200) return;
          if (meta.kind === "image" || meta.kind === "video")
            rememberKind(ref, meta.kind);
          if (typeof meta.name === "string") rememberName(ref, meta.name);
        })
        .catch(() => {
          /* Leave offline entries intact. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [library]);
  return { kinds, names, rememberKind, rememberName };
}

/** Filter missing references from the latest draft, never an earlier async snapshot. */
export function withoutMissingMedia(
  settings: Background,
  gone: MediaRef[],
): Background {
  const missing = (ref: MediaRef) =>
    gone.some((item) => mediaRefEqual(item, ref));
  const w = settings.wallpaper;
  return {
    ...settings,
    library: settings.library.filter((ref) => !missing(ref)),
    wallpaper:
      (w.kind === "image" || w.kind === "video") && missing(w.media)
        ? { kind: "none" }
        : w,
  };
}
