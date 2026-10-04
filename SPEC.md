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

Appearance belongs to the dashboard, not individual panes. No pane-level style overrides are accepted by either validator. Settings has a fixed sidebar ordered General, Appearance, Background, Panes, Import & backup, About, an independently scrolling content area and a fixed Cancel/Apply action bar. General owns Dashboard name, Logo, workspace width and navigation labels. Appearance is one scrolling page ordered Theme, Colours and Typography, with semantic subheadings and no nested tabs. Background owns Static (None, gradient presets, Custom image), Animated (Waves, Aurora with motion controls) and Overlay. Overlay groups Solid, Gradient and Custom under small headings with square colour tiles matching Custom palette fields. Only Custom opens the colour popover; its tile shows an HSL-style hue spectrum until a colour is chosen, then the picked colour. Opacity is 0–80%. Theme changes snap overlay to the matching dark/light solid or gradient unless Custom is selected. Legacy `dimming` values migrate to overlay opacity. Panes has Pane finish, conditional Glass Fine tuning (opacity and blur), and Labels. Sidebar icons/text use fixed left-aligned tracks. Section spacing and typography provide hierarchy without large enclosing cards. No miniature settings previews or typography samples are rendered. While Settings is open, draft dashboard and appearance changes preview live on the real dashboard and on the Settings dialog itself; previewing must not autosave. The Settings backdrop stays lightly dimmed without blur so the dashboard remains visible. Cancel, confirmed Close and Escape restore the exact pre-edit appearance; Apply validates and persists through the ordinary revision-protected save.

Header branding offers `icon` (square image plus name) or `logo` (wide image replacing the visible icon/name). Built-in icon choices are `grid`, `server`, `panels`. Custom artwork accepts uploads or HTTP(S) URLs; preserve aspect ratio, use the header name as the accessible/tab name, and fall back to the built-in icon/name on load failure.

Background kinds: `none`, `gradient`, `image`, `waves`, `aurora`. Local gradient presets: `dusk`, `ocean`, `forest`, `mist`. Static and Animated galleries are separate on the Background page. Custom image controls appear only while Custom is selected. Overlay modes are `dark-solid`, `dark-gradient`, `light-solid`, `light-gradient` and `custom` with `overlayOpacity` 0–80 and optional six-digit `overlayColour` for custom. Images use cover with centre/top/bottom positioning. Animated presets expose motion on/off and intensity 0–100; honour reduced motion and pause in hidden tabs. Backgrounds are decorative and must never intercept input or dim app artwork. Failed image loads use a gradient fallback.

Global glass settings: `mode` solid/glass, `opacity` 0–100 (tint strength; 0 is fully clear wash), `blur` 0–24 px. Glass uses a lightweight clear frost: one backdrop blur/saturation pass per pane, a theme-toned translucent wash (not the solid surface colour), soft shine, restrained inset edge highlights and soft depth, with opaque content above. Midnight uses a light frost wash; Daylight uses a milky wash (similar to liquid-glass-react’s over-light tint). Avoid per-pane SVG filters, mask rings and blend-mode rim stacks. A dedicated glass hue control may be added later. Keep titles/icons opaque. Fall back to solid surfaces where backdrop-filter is unavailable or reduced transparency is requested; do not claim physical refraction.

Optional custom palette contains six-digit hex `background`, `surface`, `text`, `accent`. Text contrast against both solid page and pane colours must be at least 4.5:1. Derive supporting shades and accent-button text; never accept arbitrary CSS. Glass/image contrast still requires visual judgement. Existing Midnight/Daylight presets remain available. Accent swatches are always available under a small Accent subheading, with a lighter Midnight set and a darker Daylight set (Mint matches each theme default). A Custom palette disclosure under that group exposes individual colours as square fields without a misleading enable switch. Reset colours changes only the palette. Selecting Midnight/Daylight keeps a named accent chip by remapping it to the matching colour for the new theme; other custom palette edits reset, retaining background and pane finish.

### Image preparation and portability

The browser accepts static PNG/JPEG/WebP up to 8 MiB and 20 million pixels, then fits icons within 512 × 512, logos within 1200 × 320, backgrounds within 1920 × 1920. It submits normalised raster bytes to `POST /api/images/prepare`. The server limits requests to 5 MiB and decoded images to 4 million pixels / 4096 px per side, checks format, decodes/re-encodes PNG/JPEG to strip metadata and returns a data image of at most 2 MiB. SVG/GIF uploads are not supported. Existing same-origin mutation protection applies.

Preparation never changes configuration or its revision. Prepared data images are embedded in configuration only on Apply, avoiding orphan files and making YAML/JSON backups portable. Validate data-image format, byte size and dimensions server-side on every save/import. Only header and background images accept embedded data; app links/icon URLs retain their original HTTP(S) restrictions. Full and shared exports retain uploaded artwork (with a sharing warning); remote image URLs remain references and are never fetched by the backend. Saves/imports are bounded at 8 MiB.

## Persistence and API

- `GET /api/config`: complete config with ETag revision.
- `PUT /api/config`: complete validated config; requires If-Match to prevent stale browser tabs overwriting changes.
- `GET /api/health`: liveness.
- `POST /api/import/preview`: validate and upgrade an imported configuration without persisting it.
- `POST /api/images/prepare`: validate and re-encode raster artwork without persisting it.
- `GET /api/discovery/docker`: sanitised candidates from the configured Docker endpoint only.

Edits autosave after a short delay through a serialised queue. UI reports saving, saved, failure and conflict states. Unsaved changes trigger navigation protection; conflicts require explicit reload rather than blind retries. Unknown fields/schema versions and invalid coordinates, IDs, URLs, duplicate slots and overlaps are rejected. Limits bound file size, items and apps. Writes use a temporary file in the same directory, fsync and rename. Startup rejects invalid existing configuration without replacing it.

Configuration version 2 has `dashboard` (title, optional logo/branding/builtinIcon, widthMode, width), `appearance` (showAppLabels, showButtonLabels, theme, optional paneTitleSize/fontFamily/background/glass/palette), and `items`. The optional fields preserve compatibility with existing version 2 configurations. Each item has `id`, `type: pane`, `title`, `layout: {x,y,w,h}`, and `apps`. x/y use 8 px units; w/h use app columns/rows. Each app has `id`, `name`, `url`, `icon`, `col`, `row`, `openInNewTab`, and optional Docker source identity. Empty URLs are permitted for imported templates and never launch.

Legacy version 1 is accepted only for startup migration and import preview. Convert old pixel capacity into explicit app dimensions; retain app coordinates, IDs and gaps. Scale pane positions by common horizontal/vertical factors to preserve ordering and separation, expanding workspace bounds as needed. Startup saves original bytes in a unique adjacent `.v1-*.bak` file before atomically writing version 2. Invalid or oversized migrations leave the original untouched. Version 2 startup is idempotent. Old browser PUT requests are rejected with a reload/import instruction.

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
- Selected sidebar items and in-dialog text/icon choice controls use accent fill with accent-button text; logo and theme choice cards use a light accent wash so thumbnails stay readable. Theme thumbnails use the Midnight/Daylight palette colours. Background Static and Animated galleries keep accent-border selection. Accent preset chips use accent-ring selection with a dialog-surface spacer and an interior check, not a text-coloured outline. Overlay uses square colour tiles (dark/light solid and gradient, plus a custom tile with an HSL-style hue spectrum until a colour is chosen). Colours exposes a small Accent subheading above the preset swatches; Custom palette keeps square colour fields under that group. Custom background image controls appear only when Custom is selected. Under Logo, Icon + name keeps custom artwork behind a disclosure unless already set; Full logo shows the image field directly.
- Settings copy keeps one short description or hint per block. Waves and Aurora gallery thumbnails use the same rounded rectangle shape as other swatches.
- Typography offers a Font dropdown (Geist, Rubik, Oxanium; Geist default) plus global pane-title sizing. The chosen typeface applies to the whole dashboard UI. App-label visibility belongs to Panes → Labels. Google Fonts import remains deferred to issue #3.
- One global pane finish remains mandatory. Product/repository naming remains Pane/Pane-Dashboard; LucentDash and Docks are uncommitted naming ideas.
- Live dashboard draft preview without backdrop blur and with Cancel rollback is implemented ([#4](https://github.com/Graphixa/Pane-Dashboard/issues/4)). Global glass uses a clear theme-toned frost ([#2](https://github.com/Graphixa/Pane-Dashboard/issues/2)). Deferred work: optional glass hue control, animated background reliability ([#1](https://github.com/Graphixa/Pane-Dashboard/issues/1)) and Google Fonts ([#3](https://github.com/Graphixa/Pane-Dashboard/issues/3)).
