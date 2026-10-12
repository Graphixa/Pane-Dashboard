# Pane Dashboard — v1 specification

## Purpose and scope

Pane is a lightweight, single-user application launcher served by a Go process with an embedded React/TypeScript frontend. Configuration is stored in `/config/pane.yaml`; no database, accounts or Node runtime are required in production.

V1 includes pane/app CRUD, spatial editing, appearance settings, icon search, configuration and pane import/export, and opt-in Docker discovery/import. Weather, RSS, text and iframe widgets are future work. The Add menu shows Widgets as unavailable rather than creating placeholder content.

## Invariants

- New pane positions and movement snap to a 16 px dashboard grid. Stored positions retain 8 px units for compatibility; existing layouts do not shift on upgrade. Saved width/height are app columns/rows. No compaction, overlap or neighbour displacement.
- Apps occupy explicit zero-based column/row slots within panes. Gaps are intentional. Occupied drop targets reject the move; no swapping.
- Pane size determines capacity. A pane cannot shrink past its rightmost or lowest occupied slot.
- The only resize handles are east, south and south-east; app origins never change during resize.
- Icons have one fixed 80 px size. Workspace width changes never stretch tiles; changes that clip panes are rejected.
- Desktop coordinates are canonical. Mobile is read-only and presents panes in y/x reading order, with apps in row/column order. Mobile presentation never changes saved positions.

## Measurements

| Measurement | Value |
| --- | --- |
| Visible placement / movement grid | 16 px (stored units remain 8 px) |
| Gutter between adjacent panels | 16 px |
| Maximum outer rows | 4096 |
| Attached title band / inner padding | 32 px / 12 px per side |
| Icon / cell | 80 px / 104 × 120 px |
| App cell gap | 8 px |
| Pane title / app label | Bundled UI font bold 18 px (global 14–22 px) / 13 px |
| New pane / minimum / maximum | 4 × 1 / 1 × 1 / 32 × 32 app slots |

Labels retain reserved cell height when hidden. Dashboard width supports full width, 960 px, 1200 px or a custom width (768–3840 px). Full width follows the available workspace, rounded down to 8 px, with a 3840 px ceiling; editing can expand its saved bounds. Browser resizing never saves geometry. Below 768 px, when fixed width cannot fit, or when saved panes exceed available width, use read-only presentation. The outer workspace grows vertically to fit content up to its finite row limit.

For C columns and R rows, the panel measures `(16 + 112*C)` × `(16 + 128*R)` px. Its collision frame includes 8 px surrounding padding and the title band: `(32 + 112*C)` × `(64 + 128*R)` px, or `(4 + 14*C)` × `(8 + 16*R)` library units. Required columns/rows are maximum occupied coordinate plus one, with a minimum of one. Resize constraints snap to whole app slots and enforce occupied minima and workspace bounds. Visible frame dimensions and placeholders follow the accepted snapped layout during dragging. Two default frames fit side by side in a 960 px workspace.

## Interaction

The compact header shows the configured dashboard name and optional HTTP(S) logo image URL, plus round Add, tool-shaped Edit/Done and Settings buttons. A blank name uses `pane.`; a blank or failed logo uses the built-in grid icon. Names truncate gracefully and also set the browser tab title. Remove the secondary dashboard heading, slogans, app/pane counts and footer copy. A global navigation-label setting hides visible labels without removing accessible names or tooltips. Editing has a persistent highlighted state.

Titles use the selected locally bundled UI font in bold, default 18 px, adjustable globally from 14–22 px without changing pane geometry. App labels are 13 px. Bundled typefaces are Geist (default), Rubik and Oxanium; Google Fonts import remains deferred. A dotted move grip sits at the top centre of each pane, separately from its title and menu. Only this grip starts pane dragging; keyboard nudging remains available. Offset vertical/horizontal edge marks and an L-shaped corner mark appear on hover, keyboard focus or selection with larger hit areas. Explicit handle styling overrides the grid library's default rotations. The edit grid fills the viewport below the header and grows beyond it when panes extend further down; viewport changes never alter saved geometry. Empty-address app artwork stays at full brightness in read mode, with a non-launching link and explanatory tooltip.

Read mode launches app links and hides slots, drag handles, resize handles and mutation controls. Edit mode reveals those controls; clicking an app edits it. Empty slots show square 80 px artwork placeholders with reserved label space matching app tiles. Apps may be dragged between panes or moved through explicit destination/slot fields for keyboard access. Pane settings provide Columns and Rows, without position fields. Arrow keys on a pane's move handle nudge it on the placement grid, subject to collision checks.

Add Pane immediately creates an untitled 4 × 1 pane without a dialog. Creation and successful imports enter edit mode and highlight the destination pane; pointer/focus interaction updates selection. Optional titles are attached above panels, never independent widgets. Click a title or Add title in edit mode to edit inline; Enter/blur saves and Escape cancels. Untitled read mode shows no title, but both modes reserve the title band to prevent layout shifts. Desktop editing requires sufficient viewport width. Mobile settings are view-only; imports and adding are disabled there.

## Global appearance

Appearance belongs to the dashboard, not individual panes. No pane-level style overrides are accepted by either validator. Settings has a fixed sidebar ordered General, Appearance, Background, Panes, Import & backup, About, an independently scrolling content area and a fixed Cancel/Apply action bar. Settings page titles stay in the DOM for accessibility but are visually hidden; the sidebar marks the current page. Comparable Settings rows share stable label and control columns. All Settings and customisation-sheet sliders use stacked Range (label and value above a full-width track), including Fine tuning, Theme overlay, and Motion / Effect / Tint adjust sheets. General owns Dashboard name, Logo, workspace width and navigation labels. Appearance is one scrolling page ordered Theme, Colours and Typography, with semantic subheadings and no nested tabs. Background is a Wallpaper-style page: a compact Current band (real image or paused video still, Currently set name from media meta when available, Change wallpaper, Position/Playback for image/video), then an Enhancements section ordered Tint (switch with Customise under the label — disabled when off), Screen Effects (select with Customise), Add Motion (select always visible but disabled with a hover explanation for non-photo / live / video wallpapers; Customise when a photo motion style is set; fine controls in their sheets), then a separate Readability section with Theme overlay (0–80%). Change wallpaper opens a bottom-docked Choose wallpaper sheet: Browse shows compact Colours (custom, theme-default None, accent swatches), optional Recently used (up to eight wallpapers recorded only after a successful Settings Apply), and landscape category cards (My media, Gradients, then build-time bundled categories such as Nature and Space). Opening a category replaces the body with a full thumbnail grid in the same dialog (Back restores Browse scroll/focus and draft); Add media in the header accepts supported images and videos into My media. Thumbnails are caption-free 16:9 tiles with accent border plus checkmark when selected, distinct keyboard focus, and independent removal controls for uploads. Live (video) tiles use a “Live” badge with a play mark on a still poster (or first-frame still when no poster); muted loop playback starts only on hover or keyboard focus (honour `prefers-reduced-motion`; no load-time autoplay). Category grids (My media, bundled folders, Recently used when mixed) list static items before live, preserving relative order within each group. Selecting a tile previews the draft without reordering the library; footer copy is “Apply in Settings to save.”; Use wallpaper confirms the draft choice (Settings Apply persists). Closing/Escape without Use wallpaper confirms when dirty, then restores the pre-chooser draft. Uploads go through the media store (newest-first library, explicit reject when full — no silent eviction). Bundled wallpapers use stable `builtin` IDs served from `GET /media/builtin/{builtinId}` (catalogue generated at build time from `wallpapers/`). Theme overlay is theme-derived (white in light, `--bg` in dark) with no colour picker. Panes has Pane finish, conditional Glass Fine tuning, and Labels. While Settings is open, drafts preview live without autosave. Settings opens without a dimmed lightbox so dashboard colours stay true; the dialog uses a soft drop shadow for elevation. Choose wallpaper / Motion / Effect / Tint sheets hide Settings chrome. Motion / Effect / Tint sheets use a three-region Modal layout (fixed title and Close, scrollable body, fixed Done) sized to content up to about `min(70dvh, 640px)`. Cancel, confirmed Close and Escape restore the pre-edit appearance; Apply validates and persists through the ordinary revision-protected save.

Header branding offers `icon` (square image plus name) or `logo` (wide image replacing the visible icon/name). Built-in icon choices are `grid`, `server`, `panels`. Custom artwork accepts uploads or HTTP(S) URLs; preserve aspect ratio, use the header name as the accessible/tab name, and fall back to the built-in icon/name on load failure.

Configuration version is **3** only (prototype Path A: older configs are not migrated). Background composition stores `wallpaper` (`none` | `solid` | `gradient` | `image` | `video`), `library` media references, `photoMotion`, optional `effect` (`snow` | `fireflies` | `shooting-stars`), optional creative `tint`, and `themeOverlayOpacity` 0–80. Media references are `asset`, versioned `builtin`, or remote image `url` — never embedded bytes. Paint order: base wallpaper → tint → effect → theme overlay → dashboard. Solid colours tint theme `--bg`; gradients use `dusk`/`ocean`/`forest`/`mist`. Photo motion applies only to images; videos use mute loop/static playback. Effects are transparent particles without opaque skies. Honour reduced motion and pause hidden tabs. See [docs/background-media-contracts.md](docs/background-media-contracts.md).

Global glass settings: `mode` solid/glass, `opacity` 0–100, `blur` 0–24 px, `saturation` 0–100% (applied as 0–200% CSS `saturate`), `displacement` 0–100%, `aberration` 0–100%. Saved displacement 101–150 and saturation 101–200 are the previous effect units and fold onto those controls (150 → 100, saturation percent ÷ 2). Missing tuning fields default to opacity 15, blur 2, saturation 75, displacement 100, aberration 60. When displacement is above zero, warp frost is floored at 6 px so refraction bends the backdrop rather than carving the pane edge. The edit grid positions panes with top/left (not CSS transforms) so backdrop-filter can sample the page background. Edge refraction uses a per-pane UV centre-magnifying SDF lip map (R/B displacement channels, quantised maps capped at 160 px on the long side) with an SVG filter that displaces and chromatically aberrates the rim while keeping an undisplaced centre (liquid-glass-react–style edge mask + clean centre composite) so tall or wide panes keep an even bend without a full-surface slab. Zero aberration uses a single edge-masked displacement (no RGB split). Glass uses a layered clear surface: empty warp (backdrop blur/saturation + SVG edge refraction when eligible), unfiltered theme-toned tint, soft shine, mix-blend gradient rims and outer depth only (no inset bevels), with opaque content above. Refraction stays always-on when Glass is selected, with automatic quality gates (Chromium-capable only; frost-only on Firefox/Safari; no displacement for reduced motion/transparency; frost-only while dragging/resizing; lite single-displacement when more than six panes are visible). Never apply SVG filters to tint or content. Keep titles/icons opaque. Do not claim physical or OS-level liquid glass.

Optional custom palette contains six-digit hex `background`, `surface`, `text`, `accent`. Text contrast against both solid page and pane colours must be at least 4.5:1. Derive supporting shades and accent-button text; never accept arbitrary CSS. Glass/image contrast still requires visual judgement. Existing Midnight/Daylight presets remain available. Accent swatches are always available under a small Accent subheading, with a lighter Midnight set and a darker Daylight set (Mint matches each theme default). A Custom palette disclosure under that group exposes individual colours as square fields without a misleading enable switch. Reset colours changes only the palette. Selecting Midnight/Daylight keeps a named accent chip by remapping it to the matching colour for the new theme; other custom palette edits reset, retaining background and pane finish.

### Media upload and portability

The browser uploads original PNG/JPEG/WebP images (up to 12 MiB) and WebM/MP4 videos (up to 40 MiB) to `POST /api/media/upload`, then commits via `POST /api/media/commit`. The server validates magic bytes and dimensions, preserves original accepted bytes, and stores files under a `media/` directory beside the configuration. SVG/GIF/animated WebP uploads are not supported. Same-origin mutation protection applies. Serving uses `GET /media/assets/{id}` with Range support for video, and `GET /media/builtin/{builtinId}` for the bundled catalogue.

Configuration holds media references only. Portable backups are archives (config + manifest + referenced local media). Remote image URLs remain links and are never fetched by the backend. Config saves/imports stay bounded at 8 MiB; media has separate storage quotas.

## Persistence and API

- `GET /api/config`: complete config with ETag revision.
- `PUT /api/config`: complete validated config; requires If-Match to prevent stale browser tabs overwriting changes.
- `GET /api/health`: liveness.
- `POST /api/import/preview`: validate and upgrade an imported configuration without persisting it.
- `POST /api/media/upload` / `POST /api/media/commit`: stage and durable-commit media without changing config revision until Apply.
- `GET /api/discovery/docker`: sanitised candidates from the configured Docker endpoint only.

Edits autosave after a short delay through a serialised queue. UI reports saving, saved, failure and conflict states. Unsaved changes trigger navigation protection; conflicts require explicit reload rather than blind retries. Unknown fields/schema versions and invalid coordinates, IDs, URLs, duplicate slots and overlaps are rejected. Limits bound file size, items and apps. Writes use a temporary file in the same directory, fsync and rename. Startup rejects invalid existing configuration without replacing it.

Configuration version 3 has `dashboard` (title, optional logo/branding/builtinIcon, widthMode, width), `appearance` (showAppLabels, showButtonLabels, theme, optional paneTitleSize/fontFamily/background/glass/palette), and `items`. Layout geometry matches the former schema-2 coordinates (x/y in 8 px units; w/h in app columns/rows). Older prototype schemas are rejected; delete or replace `pane.yaml` rather than migrating.

Path A (unreleased prototype): there is no v1/v2 startup migration. Invalid or unsupported configuration files are refused without replacement. Missing config still creates schema-3 defaults.

## Import and export

Settings → Import & backup offers layout files and Docker. YAML/JSON files are parsed as data, validated and previewed before applying. A full dashboard import replaces the current dashboard only after explicit confirmation. Pane templates are appended at a free position. New IDs are generated for pane-template imports. Layout exports omit app URLs and Docker source metadata by default; a separate full backup explicitly includes private addresses.

Docker import scans only when requested. Candidates include editable names, URLs and proposed icons, published TCP-port alternatives and an already-imported indicator. Selection imports to an optionally titled new pane or an existing pane. Existing panes fill empty slots in row-major order without moving any existing apps; insufficient capacity blocks the entire import. A new pane is sized to contain the selection and placed in the first valid free position. Import is all-or-nothing.

## Docker security and recognition

Disabled unless `PANE_DOCKER_ENDPOINT` is set to a Unix socket or explicitly configured HTTP(S) socket proxy. No arbitrary endpoints from browser requests. Calls only the daemon version and container-list endpoints, with timeouts and response limits; it never starts, stops, modifies or inspects container environment variables.

Direct Docker socket access is highly privileged even with a `:ro` mount. Prefer a restricted socket proxy reachable only on an internal network. Pane itself has no authentication: deploy on a trusted network or behind an authenticating reverse proxy, particularly if discovery is enabled. Same-origin mutation checks are defence in depth, not authentication.

Names derive from Compose service, container name and image repository. Exact icon catalogue matches are suggested; guesses remain editable. Published TCP ports are choices, not proof of a web UI. Wildcard addresses use the host supplied in Import settings; container-private IPs are never used. Loopback-only bindings are flagged. HTTPS, reverse proxies, host networking and ambiguous ports require review. Source identity uses endpoint scope plus Compose project/service or container name, not transient container IDs. Import never probes discovered URLs.

## Icons and extensibility

Search a bundled local catalogue of Dashboard Icons slugs; custom HTTP(S) icon URLs are supported. Artwork loads directly in the browser from jsDelivr or the supplied URL, with a letter fallback. The initial catalogue is curated, not a claim to include every upstream icon. An update script can generate the catalogue from a checked-out upstream repository. Future widgets share dashboard geometry but do not reuse app-pane content.

## Acceptance and verification

Tests cover fixed geometry, gutters, snapping, occupied destinations/minima, immediate creation, inline titles, keyboard controls, import regeneration, URL validation, schema rejection, legacy backups/migration, atomic persistence, revision conflicts and Docker sanitisation. Integration tests mount the real grid library and exercise mouse resize with live placeholders. CI runs frontend tests/type checking/build, Go tests/vet and a Docker build. Hands-on checks must cover visual alignment, desktop drag/resize blocking, persistence across reload, read-mode locking, narrow presentation and import conflicts. Missing local runtimes and browser QA must be disclosed.

## Settings refactor

- General labels are **Dashboard name** and **Logo**. Logo choices are **Icon + name** and **Full logo**. Rectangular artwork fits within 280 × 48 px on desktop, with smaller responsive limits, using object-fit contain; it is never forced into the square icon container.
- Draft settings persist across sidebar navigation. Close, Escape and Cancel require discard confirmation when changed; page unload warns while dirty. Apply validates the entire draft, including hidden sections, and preserves current app/layout items. Read-only presentation disables mutations but allows saved backups.
- Pending settings prevent import/export until applied or discarded. Import confirmation and revision-protected persistence retain their existing behaviour. Import preview titles are subsections under Import, not peer section headings.
- Selected sidebar items and in-dialog text/icon choice controls use accent fill with accent-button text; logo and theme choice cards use a light accent wash so thumbnails stay readable. Theme thumbnails use the Midnight/Daylight palette colours. Background Gradients and Dynamic tiles keep accent-border selection. Accent preset chips use accent-ring selection with a dialog-surface spacer and an interior check, not a text-coloured outline. Overlay uses square colour tiles (dark/light solid and gradient, plus a custom tile with an HSL-style hue spectrum until a colour is chosen). Colours exposes a small Accent subheading above the preset swatches; Custom palette keeps square colour fields under that group. Custom background image, custom icon and full logo each use an image popover (vertical dropzone, From URL, Cancel/OK; close/outside/Escape cancels and restores). Under Logo, Icon + name keeps built-in icons with a Custom image trigger; Full logo uses Choose logo image.
- Settings copy keeps one short description or hint per block. Waves and Aurora gallery thumbnails use the same rounded rectangle shape as other swatches.
- Typography offers a Font dropdown (Geist, Rubik, Oxanium; Geist default) plus global pane-title sizing. The chosen typeface applies to the whole dashboard UI. App-label visibility belongs to Panes → Labels. Google Fonts import remains deferred to issue #3.
- One global pane finish remains mandatory. Product/repository naming remains Pane/Pane-Dashboard; LucentDash and Docks are uncommitted naming ideas.
- Live dashboard draft preview without backdrop blur and with Cancel rollback is implemented ([#4](https://github.com/Graphixa/Pane-Dashboard/issues/4)). Global glass uses always-on edge refraction with automatic performance gates ([#2](https://github.com/Graphixa/Pane-Dashboard/issues/2)). Deferred work: optional glass hue control, animated background reliability ([#1](https://github.com/Graphixa/Pane-Dashboard/issues/1)) and Google Fonts ([#3](https://github.com/Graphixa/Pane-Dashboard/issues/3)).


## Design system implementation

[DESIGN.md](DESIGN.md) defines the visual contract: semantic typography, tokens, components, states and contribution checks. The dashboard and standalone `/design-system.html` component reference share locally bundled fonts and the same stylesheet entry point. General UI uses rem-based typography at weights 400, 600 and 700; pane titles and app labels preserve the fixed geometry above. The reference uses temporary sample data and never accesses configuration or saves changes. It is not a Settings preview or a new navigation section. New UI uses the shared components in `web/src/design`; existing specialised controls are migrated incrementally.
