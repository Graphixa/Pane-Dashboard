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

## Dependencies

- WebP: `golang.org/x/image/webp`
- PNG/JPEG: stdlib
- Video probe: pure-Go / best-effort; Phase 4 tightens codecs
- Posters: authored for built-ins; uploads may omit (theme fallback)

## Out of scope

- Production migration from schema 1/2 (Path A)
- Live shaders (#14)
- Community CSS/HTML pack import
