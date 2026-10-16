# Bundled wallpapers

Flat category folders only. Run `npm run catalogue` in `web/` (also via pretest/prebuild) to regenerate `internal/builtin/data/`, `web/public/media/builtin/`, and `web/src/generated/wallpaperCatalogue.ts`.

Requires **ffmpeg** on PATH — the catalogue step generates tiny WebP thumbs (`*-thumb@vN`) for chooser tiles and category covers. You do not author poster/thumb sidecars.

Optional `category.json` per folder:

```json
{
  "name": "Nature",
  "order": 1,
  "cover": "forest@v1",
  "version": 1,
  "licence": "Fixture — replace before release",
  "titles": { "forest": "Forest" }
}
```

Supported files: PNG, JPEG, WebP, WebM, MP4. Nested folders are rejected. Legacy `*.poster.*` / `*.thumb.*` sidecars in the folder are ignored.
