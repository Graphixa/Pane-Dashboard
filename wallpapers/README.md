# Bundled wallpapers

Flat category folders only. Run `npm run catalogue` in `web/` (also via pretest/prebuild) to regenerate `builtin/` and `web/src/generated/wallpaperCatalogue.ts`.

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

Supported files: PNG, JPEG, WebP, WebM, MP4. Poster sidecars: `name.poster.png` (served, not selectable). Nested folders are rejected.
