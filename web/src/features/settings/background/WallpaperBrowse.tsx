import {
  ScrollArea,
  SettingsGroup,
} from "../../../design/components";
import {
  accentPresets,
  gradients,
  mediaSrc,
  type Background,
  type MediaRef,
  type Wallpaper,
} from "../../../appearance";
import {
  wallpaperCatalogueCategories,
  wallpaperCatalogueItems,
  builtinThumbUrl,
} from "../../../generated/wallpaperCatalogue";
import type { RecentWallpaperEntry } from "../../../wallpaperRecent";
import { wallpaperMatches } from "../../../wallpaperRecent";
import {
  WallpaperCategoryCard,
  WallpaperColourChip,
  WallpaperCustomColour,
  WallpaperSection,
  WallpaperTile,
  type MediaKind,
} from "../../../wallpaperChooser";
import { wallpaperStillUrl } from "./useMediaMetadata";

export type WallpaperBrowseProps = {
  settings: Background;
  theme: "dark" | "light";
  customColour: string;
  presetMatch: boolean;
  solidSelected: string;
  recentEntries: RecentWallpaperEntry[];
  myMediaCover?: string;
  mediaLabel: (ref: MediaRef, kind: MediaKind) => string;
  onSelectColour: (colour: string) => void;
  onSetWallpaper: (wallpaper: Wallpaper) => void;
  onSelectMedia: (ref: MediaRef, kind: "image" | "video") => void;
  onOpenCategory: (view: "my-media" | "gradients" | `cat:${string}`, focusId: string) => void;
};

export function WallpaperBrowse({
  settings: b,
  theme,
  customColour,
  presetMatch,
  solidSelected,
  recentEntries,
  myMediaCover,
  mediaLabel,
  onSelectColour,
  onSetWallpaper,
  onSelectMedia,
  onOpenCategory,
}: WallpaperBrowseProps) {
  return (
    <div className="wallpaper-browse">
      <WallpaperSection heading="Colours" label="Colours" compact>
        <div className="wallpaper-colour-row">
          <WallpaperCustomColour
            colour={customColour}
            pressed={b.wallpaper.kind === "solid" && !presetMatch}
            onColour={onSelectColour}
          />
          <WallpaperColourChip
            name="None"
            colour={theme === "dark" ? "#1a222e" : "#eef1f4"}
            pressed={b.wallpaper.kind === "none"}
            onSelect={() => onSetWallpaper({ kind: "none" })}
          />
          {accentPresets[theme].map((p) => (
            <WallpaperColourChip
              key={p.colour}
              name={p.name}
              colour={p.colour}
              pressed={solidSelected === p.colour.toLowerCase()}
              onSelect={() => onSelectColour(p.colour)}
            />
          ))}
        </div>
      </WallpaperSection>

      {recentEntries.length > 0 && (
        <WallpaperSection heading="Recently selected" label="Recently selected">
          <SettingsGroup className="wallpaper-recent-inset">
            <ScrollArea orientation="horizontal" type="always" className="wallpaper-recent-scroll" aria-label="Recently selected wallpapers">
              <div className="wallpaper-recent-track">
                {recentEntries.map((entry) => {
                  const pressed = wallpaperMatches(b.wallpaper, entry.wallpaper);
                  const mediaWallpaper = entry.wallpaper;
                  if (mediaWallpaper.kind !== "image" && mediaWallpaper.kind !== "video") {
                    return null;
                  }
                  const kind = mediaWallpaper.kind;
                  const videoUrl =
                    kind === "video" ? mediaSrc(mediaWallpaper.media) : undefined;
                  // Catalogue thumb or photo URL — never feed a video file into <img>.
                  const thumb =
                    wallpaperStillUrl(mediaWallpaper);
                  return (
                    <WallpaperTile
                      key={entry.key}
                      label={mediaLabel(mediaWallpaper.media, kind)}
                      pressed={pressed}
                      kind={kind}
                      src={thumb}
                      videoSrc={videoUrl}
                      onSelect={() => onSelectMedia(mediaWallpaper.media, kind)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </SettingsGroup>
        </WallpaperSection>
      )}

      <WallpaperSection heading="Categories" label="Categories">
        <div className="wallpaper-category-grid">
          <WallpaperCategoryCard
            name="My media"
            coverSrc={myMediaCover}
            empty={!myMediaCover}
            onSelect={() => onOpenCategory("my-media", "My media")}
          />
          <WallpaperCategoryCard
            name="Gradients"
            paint={gradients.ocean}
            onSelect={() => onOpenCategory("gradients", "Gradients")}
          />
          {wallpaperCatalogueCategories.map((cat) => {
            const cover = wallpaperCatalogueItems[cat.coverId];
            const coverSrc = cover ? builtinThumbUrl(cover) : undefined;
            return (
              <WallpaperCategoryCard
                key={cat.id}
                name={cat.name}
                coverSrc={coverSrc}
                onSelect={() => onOpenCategory(`cat:${cat.id}`, cat.name)}
              />
            );
          })}
        </div>
      </WallpaperSection>
    </div>
  
  );
}
