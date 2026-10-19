import type { RefObject } from "react";
import { Button, Text } from "../../../design/components";
import {
  gradients,
  mediaRefEqual,
  mediaSrc,
  type Background,
  type MediaRef,
} from "../../../appearance";
import {
  builtinMediaUrl,
  builtinThumbUrl,
  wallpaperCatalogueCategories,
  wallpaperCatalogueItems,
} from "../../../generated/wallpaperCatalogue";
import {
  WallpaperTile,
  sortStaticBeforeLive,
  type MediaKind,
} from "../../../wallpaperChooser";
import { imageThumbUrl } from "./useMediaMetadata";

export type ChooserView = "browse" | "my-media" | "gradients" | `cat:${string}`;

export type WallpaperCategoryGridProps = {
  settings: Background;
  chooserView: ChooserView;
  myMediaLibrary: MediaRef[];
  myMediaSorted: MediaRef[];
  kindForRef: (ref: MediaRef) => MediaKind;
  mediaLabel: (ref: MediaRef, kind: MediaKind) => string;
  isActiveImage: (ref: MediaRef) => boolean;
  isActiveVideo: (ref: MediaRef) => boolean;
  addMediaInput: RefObject<HTMLInputElement | null>;
  onSelectGradient: (preset: keyof typeof gradients) => void;
  onSelectMedia: (ref: MediaRef, kind: "image" | "video") => void;
  onSelectBuiltin: (id: string) => void;
  onRequestRemove: (ref: MediaRef) => void;
};

function titleCase(id: string) {
  return id[0].toUpperCase() + id.slice(1);
}

export function WallpaperCategoryGrid({
  settings: b,
  chooserView,
  myMediaLibrary,
  myMediaSorted,
  kindForRef,
  mediaLabel,
  isActiveImage,
  isActiveVideo,
  addMediaInput,
  onSelectGradient,
  onSelectMedia,
  onSelectBuiltin,
  onRequestRemove,
}: WallpaperCategoryGridProps) {
    if (chooserView === "gradients") {
      return (
        <div className="wallpaper-media-grid">
          {(Object.keys(gradients) as (keyof typeof gradients)[]).map((id) => (
            <WallpaperTile
              key={id}
              label={titleCase(id)}
              pressed={
                b.wallpaper.kind === "gradient" && b.wallpaper.preset === id
              }
              paint={gradients[id]}
              onSelect={() => onSelectGradient(id)}
            />
          ))}
        </div>
      );
    }
    if (chooserView === "my-media") {
      if (!myMediaLibrary.length) {
        return (
          <div className="wallpaper-empty-media">
            <Text as="p" variant="body">
              Upload photos or muted video loops with Add media. Uploads stay in My media until you Apply settings.
            </Text>
            <Button type="button" variant="primary" onClick={() => addMediaInput.current?.click()}>
              Add media
            </Button>
          </div>
        );
      }
      return (
        <div className="wallpaper-media-grid">
          {myMediaSorted.map((ref) => {
            const kind = kindForRef(ref);
            const url = mediaSrc(ref);
            return (
              <WallpaperTile
                key={url}
                label={mediaLabel(ref, kind)}
                pressed={isActiveImage(ref) || isActiveVideo(ref)}
                kind={kind}
                src={imageThumbUrl(ref)}
                videoSrc={kind === "video" ? url : undefined}
                onSelect={() => onSelectMedia(ref, kind)}
                onRemove={() => onRequestRemove(ref)}
              />
            );
          })}
        </div>
      );
    }
    if (chooserView.startsWith("cat:")) {
      const catId = chooserView.slice(4);
      const cat = wallpaperCatalogueCategories.find((c) => c.id === catId);
      if (!cat) return null;
      const itemIds = sortStaticBeforeLive(
        cat.itemIds,
        (id) => wallpaperCatalogueItems[id]?.kind ?? "image",
      );
      return (
        <div className="wallpaper-media-grid">
          {itemIds.map((id) => {
            const item = wallpaperCatalogueItems[id];
            if (!item) return null;
            const ref: MediaRef = { source: "builtin", builtinId: id };
            const pressed =
              (b.wallpaper.kind === "image" || b.wallpaper.kind === "video") &&
              mediaRefEqual(b.wallpaper.media, ref);
            const videoUrl =
              item.kind === "video" ? builtinMediaUrl(item.id) : undefined;
            return (
              <WallpaperTile
                key={id}
                label={item.title}
                pressed={pressed}
                kind={item.kind}
                src={builtinThumbUrl(item)}
                videoSrc={videoUrl}
                onSelect={() => onSelectBuiltin(id)}
              />
            );
          })}
        </div>
      );
    }
    return null;
  
}
