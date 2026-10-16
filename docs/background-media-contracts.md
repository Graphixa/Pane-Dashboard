# Background media contracts (schema 3)

Status: Phase 0 freeze for the background-media refactor.
Agreed: 9 October 2026. Implements the decisions in [background-media-refactor-plan.md](background-media-refactor-plan.md).

**Path A (prototype):** no production migration from schema 1/2 backgrounds. Schema 3 is the only supported configuration shape. Old configs fail to load with a clear error (delete or replace `pane.yaml`); missing config still creates defaults. Do not transform legacy overlays, embedded data URIs or dynamic scenes.

## Schema version

- Runtime schema is **3** only.
- Layout coordinates remain schema-2 geometry (8 px x/y, app-column w/h). There is no v1 layout loader in the Path A rewrite.
- Stale PUT with `version` other than 3 is rejected with a reload/replace instruction.
- Configuration never stores image/video bytes.

## Discriminated media references

| `source` | Fields | Notes |
| --- | --- | --- |
| `asset` | `assetId` | Uploaded media. Opaque generated/content-addressed ID. Never a filesystem path. |
| `builtin` | `builtinId` | Immutable catalogue entry. Format `name@vN` (e.g. `aurora-loop@v1`). |
| `url` | `url` | Remote **image** HTTP(S) URL only. No remote video. |

Serving URLs (derived server-side):

| Kind | Path |
| --- | --- |
| Committed upload | `GET /media/assets/{assetId}` |
| Staged upload | `GET /media/staging/{sessionId}` |
| Built-in | `GET /media/builtin/{builtinId}` |
| Derived poster | `GET /media/assets/{assetId}/poster` |

Never treat an asset ID as a filesystem path. Reject `..`, separators and absolute paths in IDs.

### Bundled wallpaper catalogue (build time)

Source tree (repository root, flat categories only):

```text
wallpapers/
  nature/
    category.json       # optional name, order, cover, titles, licence
    forest.png
    waterfall.png
  space/
    nebula.png
```

`npm run catalogue` (`web/scripts/generate-wallpaper-catalogue.mjs`) generates:

| Output | Role |
| --- | --- |
| `builtin/catalogue.json` + `builtin/media/{id}` | Embedded by the Go server (`//go:embed`) |
| `web/public/media/builtin/*` | Vite static copies for local browse |
| `web/src/generated/wallpaperCatalogue.ts` | UI category/item metadata |

- Each supported folder becomes one category; My media and Gradients are virtual (not folders).
- Item IDs are stable `name@vN` (default `v1`); optional `category.json` cover/titles/order; folder placeholders humanise when metadata is absent.
- Empty bundled folders are omitted from the catalogue (hidden in the chooser). Catalogue generation requires ffmpeg and writes tiny WebP thumbs (`*-thumb@vN`) beside each item for chooser stills/covers.
- Nested folders and unsupported extensions fail the generator. Duplicate IDs fail the generator.
- Chooser live tiles, Recently selected live tiles, and the Background Current-band live preview share one still-first pattern: thumb while idle (no `<video>` in the DOM); after a short hover linger (~180 ms) or immediately on keyboard focus, the video mounts and plays muted; leave cancels a pending start; the thumb stays until playback paints (no black flash); honour `prefers-reduced-motion`. Builtins use catalogue thumbs; My media videos capture a bounded session still from the first hovered/focused playback; idle uploads use a neutral placeholder until then, with no hidden video request. Dashboard video does not treat autoplay rejection as a hard failure.
- Versioned builtin IDs (`name@vN`) and committed asset IDs are content-addressed: `GET /media/builtin/{id}` and `GET /media/assets/{id}` send `Cache-Control: public, max-age=31536000, immutable`. Staging (`/media/staging/`) stays `private, no-store`. Vite dev proxies `/media` to the Go server so those headers apply in local browse.

## Composition object (`appearance.background`)

```ts
type MediaRef =
  | { source: "asset"; assetId: string }
  | { source: "builtin"; builtinId: string }
  | { source: "url"; url: string };

type Wallpaper =
  | { kind: "none" }
  | { kind: "solid"; colour: string }
  | { kind: "gradient"; preset: "dusk" | "ocean" | "forest" | "mist" }
  | { kind: "image"; media: MediaRef; position: "center" | "top" | "bottom" }
  | { kind: "video"; media: MediaRef; position: "center" | "top" | "bottom";
      playback: "loop" | "static" };

type PhotoMotion = {
  style: "none" | "ken-burns" | "breathe" | "drift" | "twist";
  intensity: number; // 0–100
};

type EffectId = "snow" | "fireflies" | "shooting-stars";

type Effect = {
  id: EffectId;
  params: Record<string, string | number | boolean>;
};

type CreativeTint = {
  colour: string;   // #rrggbb
  opacity: number;  // 0–80
};

type Background = {
  wallpaper: Wallpaper;
  library: MediaRef[];
  photoMotion: PhotoMotion;
  effect?: Effect;
  tint?: CreativeTint;
  themeOverlayOpacity: number; // 0–80
};
```

Paint order: base wallpaper → optional creative tint → optional effect → theme overlay → dashboard content.

### Theme overlay

- Opacity `0–80`. At `0` fully transparent.
- Light theme: white. Dark theme: theme `--bg` / palette background.
- No colour picker, mode picker or enable switch. Default `25`.
- Independent of creative tint.

### Effects

One optional effect: `snow`, `fireflies`, or `shooting-stars` (streaks only). Transparent surroundings; no full-area multiply wash. Remove clears `effect`.

### Header logo

Uploaded header artwork uses the same media store. `dashboard.logo` is either empty, an HTTP(S) image URL, or a same-origin `/media/assets/{id}` (or staging) path. No embedded data URIs.

## Media metadata

| Field | Required | Notes |
| --- | --- | --- |
| `id`, `kind`, `mime`, `bytes`, `width`, `height`, `name`, `hash`, `createdAt` | yes | |
| `durationMs`, `codec`, `posterId` | video | when available |

## Limits

| Limit | Value |
| --- | --- |
| Config JSON/YAML request | 8 MiB |
| Image upload | 12 MiB |
| Video upload | 40 MiB |
| Image pixels | 20_000_000; max side 8192 |
| Video | max side 1920; ≤ 2_073_600 pixels; ≤ 60 s |
| Library entries | 24 (explicit reject when full) |
| Total media storage | 500 MiB |
| Staging TTL | 24 h unused |
| Archive decompressed | 600 MiB / 64 media files |

Formats: PNG/JPEG/WebP images; WebM (VP8/VP9) and MP4 (H.264). No GIF, animated WebP, SVG/HTML, remote video, or transcoding.

## Library remove and Recently selected

- Trash in My media updates the **draft** library only (no `DELETE /api/media`). Disk GC runs on successful config PUT for assets no longer referenced by wallpaper, library or logo.
- Removing an upload hides it from Recently selected immediately; successful Apply prunes saved history against the saved library, while Cancel restores draft removals. Recently selected upload tiles are hidden unless the asset remains in the current library.
- Recently selected contains only image/video wallpapers (built-in or uploaded), never colours, gradients or None. Selecting immediately updates the Settings-owned history draft, moves duplicates to the front and caps it at eight. Use wallpaper retains the draft; chooser discard restores its snapshot; Settings Cancel leaves saved history unchanged. Sidebar navigation preserves the draft. A matching successful Settings Apply saves the entire ordered history to browser storage; failed/older saves cannot commit it. Newly opened Settings loads the saved history, or the already-applied history if its save is pending. The carousel uses an inset horizontal ScrollArea.
- Metadata verifies the underlying asset exists and uses `private, no-store`; missing-file results are applied only to the latest draft of the same open chooser session. Opening Choose wallpaper probes `/api/media/meta/{id}` for library assets and drops missing files from the draft library/recent list so Apply cannot fail with `missing media asset` for ghost refs.

## Dependencies

- WebP: `golang.org/x/image/webp`
- PNG/JPEG: stdlib
- Video probe: pure-Go / best-effort; Phase 4 tightens codecs
- Posters: authored for built-ins; uploads may omit (theme fallback)

## Out of scope

- Production migration from schema 1/2 (Path A)
- Live shaders (#14)
- Community CSS/HTML pack import

Uploaded image posters at `/media/assets/{id}/poster` are generated lazily, bounded to 480 px, cached in `media/posters/` and served immutable with an ETag. They reuse validated local bytes only; remote image URLs are not fetched by the backend. Videos have no server transcoding path and return 404 for this image endpoint.
