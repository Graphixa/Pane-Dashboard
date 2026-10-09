# Background and media refactor plan

Status: implementation plan; no runtime changes made by this document.
Agreed direction: 9 October 2026.
Source baseline: `dynamic-backgrounds` at `8307422259e7c5f502bad39309a6376f2977acce`.

## Purpose and delivery rules

Replace embedded image data and full CSS/HTML dynamic wallpapers with a media-backed background system. Ship a small local collection of static wallpapers and video loops, support user uploads, retain lightweight transparent particle effects, and make composition understandable in Settings.

This document records the user's approved product direction and proposed implementation sequencing. Exact type names, endpoints and numerical media limits below are design decisions to finalise in Phase 0, not existing APIs. Implement each phase as a reviewable commit or small series. Keep intermediate builds working; do not activate a new storage/schema writer before its migration, backup and renderer paths are ready.

Read root AGENTS.md, SPEC.md and DESIGN.md before implementation. Their current embedded-image and full dynamic-scene requirements describe the old implementation. Update those specific contracts deliberately as the new behaviour lands; preserve all unrelated layout, privacy, interaction and validation requirements.

| Work | Tracking |
| --- | --- |
| Asset storage, images, migration and portable backups | [#10](https://github.com/Graphixa/Pane-Dashboard/issues/10) |
| Single transparent particle effect and scene retirement | [#11](https://github.com/Graphixa/Pane-Dashboard/issues/11) |
| Uploaded and bundled video wallpapers | [#12](https://github.com/Graphixa/Pane-Dashboard/issues/12) |
| Shared controls and Static/Animated chooser | [#13](https://github.com/Graphixa/Pane-Dashboard/issues/13) |
| Shader research, explicitly deferred | [#14](https://github.com/Graphixa/Pane-Dashboard/issues/14) |

Issue #1's full-scene polish direction is superseded for this release. Reconcile its status when scene retirement is complete; do not treat adding this plan as completing any implementation issue.

## Fixed product decisions

- Remove full CSS/HTML dynamic-scene wallpapers from the release experience. Animated wallpapers are videos. CSS/HTML remains appropriate for the supported transparent particle effects.
- Support original static PNG, JPEG and WebP images and supported WebM/MP4 videos. No GIF, animated WebP, SVG/HTML uploads, arbitrary user CSS or executable shader imports.
- Do not force images through JPEG conversion. Preserve accepted original files and transparency; derived posters/thumbnails are separate assets.
- Store uploads as media files. Configuration contains references, not image/video bytes. Include uploaded header artwork in this migration; app icon URLs need no unrelated expansion.
- One optional animated effect: Snow, Fireflies or Shooting stars. Shooting stars has streaks only, without parallax stars or an opaque sky.
- One optional photo-motion setting and one optional creative tint. Video playback is separate from photo motion.
- Permanent Theme overlay control: opacity 0–80%; white for light theme, theme-defined dark colour for dark theme. No colour picker, mode picker or enable switch. At 0% it is transparent. Retain opacity when changing theme.
- Ship built-in static wallpapers and video loops locally; exact assets/count remain to be selected.
- No live shaders in this refactor. #14 is deferred investigation, not a dependency.

## Target composition and interaction

Paint from back to front:

1. Base wallpaper: theme background, colour, gradient, image or video.
2. Optional creative tint, colouring the base wallpaper.
3. Optional transparent particle effect with its own colour controls.
4. Theme overlay, softening the entire background composition.
5. Dashboard panes, app artwork, labels and controls.

Only the image stage receives Ken Burns/Breathe/Drift/Twist transforms. Effects must not rotate or zoom with the photo. All background layers are decorative, clipped to their host, excluded from accessibility reading order and pointer-inert. Never apply their opacity/filter to dashboard content.

The main Background page retains Currently set and Change wallpaper, followed by appropriate Position/Playback controls. Add motion, Add effect and Add tint become named editable rows with Customise and Remove after selection; they are not repeatable layer-add buttons. Add motion is available for photos only. Theme overlay is a separate permanent slider.

The bottom-docked wallpaper chooser has centred Static and Animated tabs above its media choices:

| Tab | Choices |
| --- | --- |
| Static | Colours, Gradients, built-in Wallpapers and uploaded images |
| Animated | Built-in Videos and uploaded videos |

My media is filtered by tab. Tabs classify the base: a photo with Ken Burns or Snow is still Static. Open on the current draft wallpaper's tab; none/colour/gradient use Static. Browsing tabs changes no selection, playback source or saved configuration. Selecting a tile previews the draft. A successful upload selects its draft asset and routes to its matching tab; failure/cancellation retains the prior selection.

Motion, Effect, Tint and Theme overlay remain shared outside the tabs. Switching wallpapers preserves effect/tint/theme opacity and remembers photo motion without running it on video. Continue previewing the real dashboard, without introducing miniature effect previews or another Settings page hierarchy. Select/Done returns to Settings; only Apply persists the Settings draft.

## Source findings and code map

| Existing area | Required change |
| --- | --- |
| `web/src/ImageField.tsx` | Replace canvas normalisation/JPEG conversion with original-file staging; reuse for header uploads |
| `appearance.go` | Replace embedded-image validation/preparation; introduce typed media references and composition validation |
| `main.go` | Media upload/serving, import/export integration, bounded upload timeouts and required CSP sources |
| `store.go`, `migration.go`, `config.go` | Asset-aware commit/migration, schema compatibility, atomic config replacement and recovery |
| `web/src/appearance.ts`, `model.ts` | Shared reference/composition types, normalisation and client validation |
| `Background.tsx`, `appearance.css` | Separate image/video, tint, effect and theme-overlay layers |
| `web/src/dynamic/*`, `web/dynamic/*` | Extract effects, retain bounded controls/scoping, retire full-scene runtime |
| `BackgroundSettings.tsx` | Split media chooser/upload, effect picker, creative tint and theme-overlay concerns |
| `Settings.tsx`, `useConfig.ts` | Preserve drafts, asset staging, save queue and revision-conflict semantics |
| `ImportPanel.tsx` and export callers | Portable archive plus legacy YAML/JSON import |
| `web/src/design/*` | Shared accessible tabs/upload states and component-reference coverage |
| Docker/release packaging | Persistent uploaded media and locally shipped built-ins |

Current configuration is schema 2 with an 8 MiB request bound; prepared images are limited to 2 MiB and the wallpaper library silently drops old entries above four. These are not suitable video limits. Keep bounded configuration requests but introduce separate media/storage limits.

DynamicScene currently paints a gradient, and Snow/Stars/Fireflies paint opaque backgrounds. The sanitiser additionally injects a full-area multiply tint. Remove that wash from effects rather than simply making the sky transparent, or it may tint the underlying photo. Scope colour updates to the intended renderer instance: the current global query for every .scene-dynamic is unsuitable for independent wallpaper/effect/thumbnail hosts.

Background.tsx names a reduced-motion subscription reduceTransparency. Correct that naming and treat reduced motion and reduced transparency as distinct policies.

## Phase 0 — Freeze contracts and migration fixtures

Dependencies: none. Issues: #10–#13.

1. Define the next configuration schema (proposed version 3) and a single migration chain from v1/v2. Preserve all pane/app IDs, coordinates, intentional gaps and unrelated appearance settings.
2. Define discriminated media references: uploaded asset ID, immutable/versioned built-in ID, and existing permitted remote image URL. Derive serving URLs server-side. Never treat an asset ID as a filesystem path.
3. Separate base wallpaper, media-library references, photo motion, video playback preference, optional effect, optional creative tint and themeOverlayOpacity. Do not persist tab selection, temporary object URLs, visibility or browser capabilities.
4. Define media metadata: kind, validated MIME/container/codec where relevant, dimensions, bytes, name, hash, optional duration and derived poster reference.
5. Decide limits for file size, decoded pixels, video duration/resolution, library count, total storage, staging lifetime and archive expansion. Reject full storage explicitly; remove silent eviction.
6. Choose bounded server-side WebP validation and video probing dependencies. Specify supported codec combinations, poster generation and thumbnail policy. No automatic video transcoding in the first version.
7. Fix the theme dark overlay token and initial opacity default. Record legacy overlay/scene mappings and any visual compromises before writing migration.
8. Add representative migration fixtures: embedded header/background, image library, remote image, each old scene ID, all overlay modes, old motion flags, invalid data and unknown schema versions.

Gate: client/server contracts, limits and mapping table are documented and fixtures exist. No invented claim of universal MP4/WebM support; exact release artwork remains a separately tracked selection task.

## Phase 1 — Implement filesystem assets and serving

Dependencies: Phase 0. Issue: #10; foundation for #12.

1. Add a small media-store module next to the config store, using a persistent directory beside the configured YAML file. No database.
2. Separate immutable uploaded files, bounded metadata, temporary upload sessions and read-only bundled catalogue entries. Use generated/content-addressed IDs and no user-selected paths.
3. Stream uploads under byte limits to temporary files. Verify actual format and dimensions before accepting; do not rely on extension or client MIME. Preserve original accepted bytes. Reject corrupt, unsupported and oversized inputs cleanly.
4. Add staging responses containing stable references and preview metadata, without modifying config or ETag. Preview may use staged serving URLs or short-lived object URLs; neither goes into saved config.
5. Implement asset resolution and GET/HEAD serving with correct MIME, nosniff, caching and HTTP Range support for video files.
6. Keep existing same-origin mutation protection. Review upload timeouts separately from ordinary JSON operations and video streaming; do not remove all bounds.
7. Add a reachability-based cleanup design protecting committed references, live staging sessions and retained recovery snapshots. Do not delete files simply because a picker closes.

Gate: original-byte preservation, validation, quota enforcement, serving/range responses and staged-file cleanup can be exercised independently of schema activation.

## Phase 2 — Complete durable saves, backup and migration machinery

Dependencies: Phase 1. Issue: #10.

Implement behind the old public writer until Phase 6 activation.

1. Make config validation resolve every local asset reference and verify its intended media kind. Validate both the selected wallpaper and saved media-library entries.
2. On Apply, validate revision and draft references, make required assets durable first, then atomically replace configuration through the existing store. Coordinate garbage collection with this transaction.
3. Preserve the old config on failure. Unreferenced files after a crash are recoverable garbage; a committed reference to a missing file is not acceptable. Retain the draft after save/conflict errors; never blindly retry a stale revision.
4. Build a portable archive exporter containing config, manifest and referenced local media, including library entries/header artwork. Snapshot config/references and protect files throughout export.
5. Define how exact built-in content restores across versions: immutable retained catalogue versions or inclusion of required bytes. Do not assume an unversioned built-in ID remains available forever.
6. Import archives into staging, validate all entries and references, preview the result, then commit only on the existing explicit confirmation/save path. Enforce total decompressed size/count, path containment, no symlinks and duplicate-entry rejection.
7. Retain legacy YAML/JSON import. Distinguish portable backups from config-only export. Keep shared-template privacy rules and include only relevant media; remote URLs remain links and are never fetched by the backend.
8. Implement idempotent embedded-media extraction. Back up original config bytes uniquely before activation; write extracted files durably before replacing config. Previously converted JPEGs cannot regain lost transparency/quality.
9. Ensure v1 layout migration executes once and v2-to-v3 media migration never repeats coordinate scaling. Reject stale old-schema PUT requests with a reload/import instruction.
10. Handle startup/import failures and interrupted migration without replacing invalid input. Retain assets referenced by supported rollback snapshots.

Gate: backup/restore round trips, Cancel, conflict, disk-full, interrupted upload, crash windows and retry migration tests pass. A new-schema renderer must exist before activating startup migration.

## Phase 3 — Build the composition renderer and extract effects

Dependencies: Phase 0; use new asset resolver when available. Issue: #11 and tint portion of #13.

1. Introduce focused base, photo-motion, creative-tint, effect and theme-overlay components with shared lifecycle policy. Keep animation ticks outside whole-dashboard React state.
2. Implement Theme overlay as a uniform theme-derived layer and bounded opacity only. Do not merge it with the creative colour wash.
3. Extract Snow and Fireflies with fully transparent surroundings. Extract Shooting stars streaks independently; exclude parallax dots and sky.
4. Replace the effects' full-area multiply colouring with particle-local colour variables or another verified isolated implementation. Keep effect controls bounded and CSS/HTML scoped.
5. Enforce a single optional effect object on both sides. Retain parameters when temporarily disabled; Remove clears the applied effect.
6. Honour reduced motion, hidden-tab pausing and existing reduced-transparency pane fallbacks. Include pseudo-elements in CSS animation pause rules.
7. Preserve compatibility rendering temporarily for old saved configs until the complete migration is activated. Do not expose new legacy-scene choices.

Gate: image + each effect renders without unexpected photo recolouring; tint and theme overlay are independent; input/layout/labels remain unaffected; lifecycle checks pass.

## Phase 4 — Add video playback and the bundled catalogue

Dependencies: Phases 1 and 3; Phase 2 required before shipping persistence. Issue: #12.

1. Extend asset validation with the agreed WebM/MP4 codec/container rules and bounded metadata probing. Return actionable unsupported-format errors; GIF stays rejected.
2. Add a VideoWallpaper renderer: silent loop, inline playback, cover positioning, poster/static fallback and explicit playback preference. Handle failed play promises, failed decode and missing media.
3. Pause hidden videos and honour reduced motion. Resume only when visibility, user preference and motion policy permit it. Release replaced sources/resources and preview object URLs.
4. Add video upload/progress/validation states through the same staging model as images. Generate/store posters using the Phase 0 strategy.
5. Add a local built-in catalogue with stable versioned IDs, display metadata, posters and distribution licence/attribution records. Select actual release artwork before this phase closes.
6. Keep video files out of JavaScript payloads. Picker tiles load posters, not all video streams. Package assets for offline/self-hosted deployment and review container/release size.
7. Reuse the same renderer for built-in/uploaded media. Built-ins are immutable and excluded from upload deletion.
8. Verify content policy and serving allow only required local/staged media sources. No remote video fetching in this scope.

Gate: actual supported clips work in target browsers with fallback, range serving, glass and a single effect; built-ins work offline; no unselected gallery video downloads.

## Phase 5 — Assemble the final Settings and chooser UX

Dependencies: Phases 2–4. Issue: #13.

1. Refactor BackgroundSettings.tsx into cohesive sections without changing the shared design-system entry point. Add a shared Radix-backed tabs primitive/reference example if one is not already exposed.
2. Build centred Static/Animated chooser tabs, filtered shelves and Show all views. Preserve the bottom-docked non-lightbox live-preview behaviour, usable scrolling, keyboard focus and the compact Current band.
3. Keep all enhancement controls on the main page. Show Add motion for photos, Add effect and Add tint; selected additions become Customise/Remove rows. Show video Playback/Position instead of photo-motion transforms.
4. Add the permanent 0–80% Theme overlay slider with helper copy: “Lightens or darkens the background to suit your theme.” No colour control or switch.
5. Integrate original-image/video upload with progress, cancel, retry, limits and format errors. Successful upload selects/routes by type; selecting an existing item never reorders the library.
6. Handle active-item removal through explicit replacement/fallback choices; keep all removals draft-only until Apply and protect still-referenced files.
7. Preserve nested picker rollback as well as whole-Settings Cancel/confirmed Close/Escape. Tab browsing never selects/saves. Stop discarded draft video playback and reinstate saved playback policy.
8. Integrate archive backup/import UI and missing-asset states. Respect existing restrictions on import/export while Settings contains pending changes.
9. Update header upload use to the same asset-backed flow and test preservation of aspect ratio/transparency.

Gate: end-to-end upload, choose, customise, Cancel, Apply, reload and conflict flows work for images/videos in both themes; no duplicated settings per tab.

## Phase 6 — Activate migration and retire the old system

Dependencies: Phases 2–5. Issues: #10–#13.

1. Review the completed migration mapping against fixtures and available bundled assets.
2. For legacy Snow/Fireflies, map to a suitable static base plus matching effect where feasible. Other scenes need a documented static fallback or an explicitly selected bundled replacement. Do not assume equivalent videos exist.
3. Never equate the old parallax starfield to Shooting stars without explaining the visual change. Retain original configuration backups and provide migration/import notices where appearances change.
4. Map theme-matching solid overlays to theme opacity. Preserve custom/gradient legacy tint data through compatible creative-tint rendering where needed; avoid applying the same old opacity to both layers and double dimming.
5. Enable the new writer/startup migration only when all references and media can render and export/import can round-trip.
6. Remove full-scene runtime, Dynamic shelf/Customise controls, obsolete data-URI writer, JPEG conversion, silent library truncation and unused scene CSS. Retain only necessary legacy readers/migration code and effects.
7. Update SPEC.md, AGENTS.md, DESIGN.md, docs/dynamic-backgrounds.md (replace or redirect it), setup/backup guidance and release notes. Explain the persistent media directory and config-only backup limitations.
8. Reconcile issue #1 without closing it as “fixed animation” if its implementation was retired.

Gate: clean install and upgrade reach the same supported schema; no new persisted media bytes or full dynamic-scene renderer remain; documented recovery is possible.

## Phase 7 — Verify and release

Dependencies: all previous gates.

Run the repository-required checks:

```sh
# From web/
npm ci
npm test
npm run build

# From the repository root
go test ./...
go vet ./...
```

Also run the configured CI/race/Docker checks and record browser evidence. Do not claim unavailable checks passed.

| Area | Required evidence |
| --- | --- |
| Storage | Original image hashes/format/transparency retained; independent quotas; staged cancellation; no dangling committed references |
| Migration | v1/v2 fixtures, all old scene/overlay modes, idempotent restart, original-byte backup, failed migration untouched |
| Backup | Clean-machine portable restore, missing/conflicting entries, built-in version resolution, oversized/traversal archive rejection |
| Concurrency | Stale revisions, simultaneous upload/remove/save, cleanup racing export, crash/disk-full recovery |
| Rendering | Each effect over bright/dark images and video; isolated particle colour; photo transforms do not move effect host |
| Playback | Supported codecs in target browsers, mute/loop, rejected autoplay, poster fallback, hidden tabs, reduced motion |
| UX | Both themes, three fonts, keyboard/focus/Escape, 200% zoom, narrow read-only layout, slow/error/full-storage states |
| Performance | Idle dashboard, video + effect + glass, many panes, settings preview, no global per-frame React updates or gallery-wide playback |
| Release | Built-ins available offline, licence records, bounded package size, persistent volume survives container replacement |

Close issues only against their acceptance criteria. Shader investigation remains open/deferred.

## Rollback and release boundaries

Before rollout, retain the old configuration backup, media directory and relevant built-in versions. An older executable cannot be assumed to understand the new schema: rollback must restore the matching pre-migration configuration, not point old code at v3. Newly uploaded media after upgrade will not exist in that older configuration; retain those files for recovery rather than deleting them during rollback.

Do not release asset-backed writes without portable backup/restore. Do not retire full scenes before migration/fallback policy is implemented. Do not ship clips without resolved distribution rights. Do not add shader work to unblock any phase.

## Suggested commit sequence

1. Document target contracts, limits and migration fixtures.
2. Add filesystem assets, staged uploads and bounded serving.
3. Add asset-aware save, archive backup/import and inactive migration machinery.
4. Add independent composition layers and transparent effects.
5. Add video validation/playback and versioned bundled media.
6. Add Static/Animated chooser and shared enhancement controls.
7. Activate migration and remove legacy scene/image-writing paths.
8. Complete release packaging, documentation and verification evidence.

Phases 3 and 4 may be developed against fixtures while storage integration is finishing, but dependency gates determine activation and release order. Recheck branch changes before implementing; this plan is grounded in the baseline recorded above.
