# Pane Dashboard — v1 specification

## Purpose and scope

Pane is a lightweight, single-user application launcher served by a Go process with an embedded React/TypeScript frontend. Configuration is stored in `/config/pane.yaml`; no database, accounts or Node runtime are required in production.

V1 includes pane/app CRUD, spatial editing, appearance settings, icon search, configuration and pane import/export, and opt-in Docker discovery/import. Weather, RSS, text and iframe widgets are future work. The Add menu shows Widgets as unavailable rather than creating placeholder content.

## Invariants

- Panes occupy an integer 24-column dashboard grid. No compaction, overlap or neighbour displacement.
- Apps occupy explicit zero-based column/row slots within panes. Gaps are intentional. Occupied drop targets reject the move; no swapping.
- Pane size determines capacity. A pane cannot shrink past its rightmost or lowest occupied slot.
- The only resize handles are east, south and south-east; app origins never change during resize.
- App size is global: small/medium/large. A size or width change that clips existing content is rejected with an explanation. No automatic pane enlargement.
- Desktop coordinates are canonical. Mobile is read-only and presents panes in y/x reading order, with apps in row/column order. Mobile presentation never changes saved positions.

## Measurements

| Measurement | Value |
| --- | --- |
| Dashboard columns | 24 |
| Outer row height / gutter | 24 px / 8 px |
| Maximum outer rows | 256 |
| Pane header / padding | 40 px / 12 px per side |
| Small icon / cell | 48 px / 72 × 88 px |
| Medium icon / cell | 64 px / 88 × 104 px |
| Large icon / cell | 80 px / 104 × 120 px |
| App cell gap | 8 px |
| Empty pane minimum | one app cell plus pane chrome |

Labels retain reserved cell height when hidden. Dashboard width supports full width, 960 px, 1200 px or a custom width (768–3840 px). Full width uses a stored reference width for validation and editing; narrower browsers use read-only presentation if occupied content would no longer fit. Browser resizing never saves geometry. The outer workspace grows vertically to fit content up to its finite row limit.

Capacity: `floor((innerSize + gap) / (cellSize + gap))`. Required columns/rows are maximum occupied coordinate plus one, with a minimum of one. Outer minima are the ceiling of required pixel dimensions converted to the library grid. These conversions are the only application-owned layout calculations.

## Interaction

The header has round Add, tool-shaped Edit/Done and Settings buttons. A global navigation-label setting hides visible labels without removing accessible names or tooltips. Editing has a persistent highlighted state.

Read mode launches app links and hides slots, drag handles, resize handles and mutation controls. Edit mode reveals those controls; clicking an app edits it. Apps may be dragged between panes or moved through explicit destination/slot fields for keyboard access. Pane editing also provides numeric geometry fields.

Add Pane and successful imports enter edit mode and highlight the destination pane. Untitled panes are supported. Desktop editing requires sufficient viewport width. Mobile settings are view-only; imports and adding are disabled there.

## Persistence and API

- `GET /api/config`: complete config with ETag revision.
- `PUT /api/config`: complete validated config; requires If-Match to prevent stale browser tabs overwriting changes.
- `GET /api/health`: liveness.
- `GET /api/discovery/docker`: sanitised candidates from the configured Docker endpoint only.

Edits autosave after a short delay through a serialised queue. UI reports saving, saved, failure and conflict states. Unsaved changes trigger navigation protection; conflicts require explicit reload rather than blind retries. Unknown fields/schema versions and invalid coordinates, IDs, URLs, duplicate slots and overlaps are rejected. Limits bound file size, items and apps. Writes use a temporary file in the same directory, fsync and rename. Startup rejects invalid existing configuration without replacing it.

Configuration version 1 has `dashboard` (title, widthMode, width), `appearance` (appSize, showAppLabels, showButtonLabels, theme), and `items`. Each item has `id`, `type: pane`, `title`, `layout: {x,y,w,h}`, and `apps`. Each app has `id`, `name`, `url`, `icon`, `col`, `row`, `openInNewTab`, and optional Docker source identity. Empty URLs are permitted for imported templates and never launch.

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

Tests cover geometry limits, intentional gaps, occupied destinations, pane capacity, appearance changes, import regeneration, URL validation, schema rejection, atomic persistence, revision conflicts and Docker sanitisation. CI runs frontend tests/type checking/build, Go tests/vet and a Docker build. Interaction checks must cover desktop drag/resize blocking, persistence across reload, read-mode locking, narrow presentation, import conflicts and keyboard controls. A release is not certified until these checks pass; missing local runtimes must be disclosed.
