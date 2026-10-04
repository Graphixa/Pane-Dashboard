# V1 implementation verification

## Settings hierarchy refinement

- All 45 frontend tests, strict TypeScript checking and the production build pass after `npm ci`. Coverage verifies the single Appearance page, removed miniature previews, app-label controls in Panes, glass tuning retained across finish changes, independent accent choices, draft navigation, hidden-field validation and discard protection.
- `go test ./...` and `go vet ./...` pass. Dependencies and schema remain unchanged.
- Sidebar icons and labels use explicit grid tracks rather than inherited button centring. Major sections use consistent typography, whitespace and subtle dividers; Panes separates Pane finish, Fine tuning and Labels.
- Reviewed the supplied screenshots. A local Chromium launch was attempted but exited before rendering in this execution environment; fresh browser screenshots and physical layout checks remain outstanding. Check sidebar alignment, both themes, short/narrow viewports, scrolling and upload controls on the target browser.
- Live dashboard draft preview without backdrop blur and Cancel rollback are covered for [issue #4](https://github.com/Graphixa/Pane-Dashboard/issues/4). Preview updates shell and Settings chrome without calling Apply; Cancel restores the prior applied appearance.

## Settings sidebar refactor

- `npm ci`, all 43 frontend tests, TypeScript checking and the production build pass. New tests cover drafts surviving navigation, keyboard sub-tabs, hidden-field validation, discard confirmation for Escape/Close/Cancel, unload warnings and import/export protection while dirty.
- `go test ./...` and `go vet ./...` pass. No backend schema or dependency changes.
- General now includes Dashboard name and Logo; Appearance contains Theme, Colours, Background and Typography; Panes owns the global finish. Updated previews occupy normal flow and the action bar stays outside the scrolling content.
- Browser visual QA remains outstanding: Chromium was unavailable and its download failed in this workspace. Review both themes, wide PNG logos, long names, short viewport heights and responsive navigation on the target browser.
- Glass finish uses a clear theme-toned frost (not solid surface paint), one backdrop-filter per pane, soft shine and inset edge highlights (#2); reduced-transparency falls back to solid surfaces. Deferred: optional glass hue control, animated backgrounds #1, Google Fonts #3.

## Global appearance and portable uploads

- 38 frontend tests pass, including image input preparation, URL/data-image validation, live global settings, cancelled drafts, logo failure fallback, motion-off state and rejection of per-pane overrides. TypeScript and the production build pass.
- Go tests with race detection and `go vet` pass. Added coverage checks preparation without persistence, revision-protected saving of artwork, restart and YAML backup/restore, import preview, malformed/oversized images, cross-origin rejection and palette contrast validation.
- No dependency versions or packages changed in this update.
- Manual browser checks remain required: crop/fit of square and wide images, transparent logos, sticky preview, glass blur over photographs, both themes, long titles, reduced-motion/transparency preferences, upload cancellation and two-tab revision conflicts. The available browser environment has not provided visual QA of the local app.
- Test backups on the target deployment, including uploaded images. Remote URLs are references, not embedded assets; check HTTPS/mixed-content behaviour and reverse-proxy request limits.

## Header and visual refinements

- `npm ci`, all 29 frontend tests, TypeScript checking and the production build passed. Real-grid tests cover 16 px mouse snapping alongside live resizing and collision blocking.
- Branding tests cover saving the header name/logo and global title size, image failure fallback, and removal of the secondary heading/footer. Addressless apps retain their non-launching tooltip behaviour; the dimming style is removed.
- `go test -race ./...` and `go vet ./...` passed, including logo URL validation and branding persistence across restart.
- UI fonts are served locally via `@fontsource/geist`, `@fontsource/rubik` and `@fontsource/oxanium`. Licences are distributed under `web/public/fonts/`.
- Visual browser QA remains outstanding. Check both themes, long header names, logo loading and edge/corner grip appearance on a real browser before a release.

## Tile-based redesign

- Preserved the updated dependency manifest and lockfile from main at `599b0fa`.
- `npm ci`, all 26 frontend tests, strict TypeScript checking and the Vite production build passed.
- The real React Grid Layout integration test exercises live row resizing, occupied-slot shrink prevention, neighbour collision blocking and narrow-screen locking. DOM tests cover immediate creation, attached title editing/cancellation, square placeholders and keyboard selection/movement.
- `go test -race ./...` and `go vet ./...` passed, including original-byte legacy backup, migration idempotence, read-only import preview and rejection of old-schema saves.
- Visual browser QA remains outstanding: the cloud browser could not access the local preview. Docker builds are verified by repository CI; a running deployment still needs the target-host checks below.

## Passed during initial implementation

- 20 frontend tests: validation, intentional gaps, occupied slots, cross-pane moves, minimum dimensions, import atomicity, privacy-preserving export, read/edit boundaries, autosave revision headers, accessible tile names, actual grid mounting after asynchronous loading and narrow-screen locking.
- TypeScript strict type checking and Vite production build.
- Go tests, including race detection: configuration validation, strict decoding, file persistence, failed-save rollback, revision conflicts, cross-origin rejection and sanitised read-only Docker discovery against a mock daemon.
- `go vet ./...`.
- `npm audit --omit=dev`: no known vulnerabilities at the time of checking.
- GitHub Actions passed all checks, including the Docker image build: [initial verification run](https://github.com/Graphixa/Pane-Dashboard/actions/runs/35428114546).
- Local compiled-server smoke test: health, configuration with ETag, and embedded frontend all returned HTTP 200.

## Not yet verified

- A running container deployment on a real host: GitHub Actions built the image successfully, but deployment still needs testing in the target environment.
- Visual browser QA and physical drag/resize interactions: the available cloud browser blocked access to the local development server. DOM integration tests are not a substitute for these checks.
- Discovery against a live Docker daemon: backend tests use a mock daemon. Test your socket proxy and port mappings before enabling it for regular use.

## Before a release

1. Confirm GitHub Actions is green, then run `docker compose up -d --build`.
2. Create two adjacent panes. Verify dragging/resizing never pushes neighbours and gaps survive reload.
3. Add a pane: expect four columns and one row without a dialog. Put an app in column four. Verify shrinking to three columns is blocked until the app is moved; live placeholders follow whole-slot resizing.
4. Drag apps between empty slots/panes; reject occupied targets. Check east, south and south-east handles.
5. Check read-mode locking, hidden-label accessible names, keyboard editor controls, themes and narrow-screen presentation. Edit an attached title inline; check Enter/blur save, Escape cancels and Done causes no panel jump. Check 16 px gutters and matching 80 px icons/placeholders.
6. Reload after saves. Test two-tab conflicts, server disconnection/retry, full backup restore and shared template import.
7. Test Docker import with multiple ports, loopback bindings, already-imported Compose services and a full destination pane.

Widgets remain a future extension, not an implemented v1 feature. The icon picker starts with a curated local catalogue; maintainers can refresh it with `npm run icons -- /path/to/dashboard-icons`.
