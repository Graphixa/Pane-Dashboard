# Pane Dashboard — v1 specification

## Purpose and scope

Pane is a lightweight, single-user application launcher served by a Go process with an embedded React/TypeScript frontend. Configuration is stored in `/config/pane.yaml`; no database, accounts or Node runtime are required in production.

V1 includes pane/app CRUD, spatial editing, appearance settings, icon search, configuration and pane import/export, and opt-in Docker discovery/import. Weather, RSS, text and iframe widgets are future work. The Add menu shows Widgets as unavailable rather than creating placeholder content.

## Invariants

- Pane positions occupy an 8 px dashboard grid. Saved width/height are app columns/rows. No compaction, overlap or neighbour displacement.
- Apps occupy explicit zero-based column/row slots within panes. Gaps are intentional. Occupied drop targets reject the move; no swapping.
- Pane size determines capacity. A pane cannot shrink past its rightmost or lowest occupied slot.
- The only resize handles are east, south and south-east; app origins never change during resize.
- Icons have one fixed 80 px size. Workspace width changes never stretch tiles; changes that clip panes are rejected.
- Desktop coordinates are canonical. Mobile is read-only and presents panes in y/x reading order, with apps in row/column order. Mobile presentation never changes saved positions.

## Measurements

| Measurement | Value |
| --- | --- |
| Placement grid | 8 px |
| Gutter between adjacent panels | 16 px |
| Maximum outer rows | 4096 |
| Attached title band / inner padding | 32 px / 12 px per side |
| Icon / cell | 80 px / 104 × 120 px |
| App cell gap | 8 px |
| New pane / minimum / maximum | 4 × 1 / 1 × 1 / 32 × 32 app slots |

Labels retain reserved cell height when hidden. Dashboard width supports full width, 960 px, 1200 px or a custom width (768–3840 px). Full width follows the available workspace, rounded down to 8 px, with a 3840 px ceiling; editing can expand its saved bounds. Browser resizing never saves geometry. Below 768 px, when fixed width cannot fit, or when saved panes exceed available width, use read-only presentation. The outer workspace grows vertically to fit content up to its finite row limit.

For C columns and R rows, the panel measures `(16 + 112*C)` × `(16 + 128*R)` px. Its collision frame includes 8 px surrounding padding and the title band: `(32 + 112*C)` × `(64 + 128*R)` px, or `(4 + 14*C)` × `(8 + 16*R)` library units. Required columns/rows are maximum occupied coordinate plus one, with a minimum of one. Resize constraints snap to whole app slots and enforce occupied minima and workspace bounds. Visible frame dimensions and placeholders follow the accepted snapped layout during dragging. Two default frames fit side by side in a 960 px workspace.

## Interaction

The header has round Add, tool-shaped Edit/Done and Settings buttons. A global navigation-label setting hides visible labels without removing accessible names or tooltips. Editing has a persistent highlighted state.

Read mode launches app links and hides slots, drag handles, resize handles and mutation controls. Edit mode reveals those controls; clicking an app edits it. Empty slots show square 80 px artwork placeholders with reserved label space matching app tiles. Apps may be dragged between panes or moved through explicit destination/slot fields for keyboard access. Pane settings provide Columns and Rows, without position fields. Arrow keys on a pane's move handle nudge it on the placement grid, subject to collision checks.

Add Pane immediately creates an untitled 4 × 1 pane without a dialog. Creation and successful imports enter edit mode and highlight the destination pane; pointer/focus interaction updates selection. Optional titles are attached above panels, never independent widgets. Click a title or Add title in edit mode to edit inline; Enter/blur saves and Escape cancels. Untitled read mode shows no title, but both modes reserve the title band to prevent layout shifts. Desktop editing requires sufficient viewport width. Mobile settings are view-only; imports and adding are disabled there.

## Persistence and API

- `GET /api/config`: complete config with ETag revision.
- `PUT /api/config`: complete validated config; requires If-Match to prevent stale browser tabs overwriting changes.
- `GET /api/health`: liveness.
- `POST /api/import/preview`: validate and upgrade an imported configuration without persisting it.
- `GET /api/discovery/docker`: sanitised candidates from the configured Docker endpoint only.

Edits autosave after a short delay through a serialised queue. UI reports saving, saved, failure and conflict states. Unsaved changes trigger navigation protection; conflicts require explicit reload rather than blind retries. Unknown fields/schema versions and invalid coordinates, IDs, URLs, duplicate slots and overlaps are rejected. Limits bound file size, items and apps. Writes use a temporary file in the same directory, fsync and rename. Startup rejects invalid existing configuration without replacing it.

Configuration version 2 has `dashboard` (title, widthMode, width), `appearance` (showAppLabels, showButtonLabels, theme), and `items`. Each item has `id`, `type: pane`, `title`, `layout: {x,y,w,h}`, and `apps`. x/y use 8 px units; w/h use app columns/rows. Each app has `id`, `name`, `url`, `icon`, `col`, `row`, `openInNewTab`, and optional Docker source identity. Empty URLs are permitted for imported templates and never launch.

Legacy version 1 is accepted only for startup migration and import preview. Convert old pixel capacity into explicit app dimensions; retain app coordinates, IDs and gaps. Scale pane positions by common horizontal/vertical factors to preserve ordering and separation, expanding workspace bounds as needed. Startup saves original bytes in a unique adjacent `.v1-*.bak` file before atomically writing version 2. Invalid or oversized migrations leave the original untouched. Version 2 startup is idempotent. Old browser PUT requests are rejected with a reload/import instruction.

## Import and export

Settings → Import offers layout files and Docker. YAML/JSON files are parsed as data, validated and previewed before applying. A full dashboard import replaces the current dashboard only after explicit confirmation. Pane templates are appended at a free position. New IDs are generated for pane-template imports. Layout exports omit app URLs and Docker source metadata by default; a separate full backup explicitly includes private addresses.

Docker import scans only when requested. Candidates include editable names, URLs and proposed icons, published TCP-port alternatives and an already-imported indicator. Selection imports to an optionally titled new pane or an existing pane. Existing panes fill empty slots in row-major order without moving any existing apps; insufficient capacity blocks the entire import. A new pane is sized to contain the selection and placed in the first valid free position. Import is all-or-nothing.

## Docker security and recognition

Disabled unless `PANE_DOCKER_ENDPOINT` is set to a Unix socket or explicitly configured HTTP(S) socket proxy. No arbitrary endpoints from browser requests. Calls only the daemon version and container-list endpoints, with timeouts and response limits; it never starts, stops, modifies or inspects container environment variables.

Direct Docker socket access is highly privileged even with a `:ro` mount. Prefer a restricted socket proxy reachable only on an internal network. Pane itself has no authentication: deploy on a trusted network or behind an authenticating reverse proxy, particularly if discovery is enabled. Same-origin mutation checks are defence in depth, not authentication.

Names derive from Compose service, container name and image repository. Exact icon catalogue matches are suggested; guesses remain editable. Published TCP ports are choices, not proof of a web UI. Wildcard addresses use the host supplied in Import settings; container-private IPs are never used. Loopback-only bindings are flagged. HTTPS, reverse proxies, host networking and ambiguous ports require review. Source identity uses endpoint scope plus Compose project/service or container name, not transient container IDs. Import never probes discovered URLs.

## Icons and extensibility

Search a bundled local catalogue of Dashboard Icons slugs; custom HTTP(S) icon URLs are supported. Artwork loads directly in the browser from jsDelivr or the supplied URL, with a letter fallback. The initial catalogue is curated, not a claim to include every upstream icon. An update script can generate the catalogue from a checked-out upstream repository. Future widgets share dashboard geometry but do not reuse app-pane content.

## Acceptance and verification

Tests cover fixed geometry, gutters, snapping, occupied destinations/minima, immediate creation, inline titles, keyboard controls, import regeneration, URL validation, schema rejection, legacy backups/migration, atomic persistence, revision conflicts and Docker sanitisation. Integration tests mount the real grid library and exercise mouse resize with live placeholders. CI runs frontend tests/type checking/build, Go tests/vet and a Docker build. Hands-on checks must cover visual alignment, desktop drag/resize blocking, persistence across reload, read-mode locking, narrow presentation and import conflicts. Missing local runtimes and browser QA must be disclosed.
