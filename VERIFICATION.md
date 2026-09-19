# V1 implementation verification

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
3. Put an app in column four. Verify shrinking to three columns is blocked until the app is moved.
4. Drag apps between empty slots/panes; reject occupied targets. Check east, south and south-east handles.
5. Check read-mode locking, hidden-label accessible names, keyboard editor controls, themes and narrow-screen presentation.
6. Reload after saves. Test two-tab conflicts, server disconnection/retry, full backup restore and shared template import.
7. Test Docker import with multiple ports, loopback bindings, already-imported Compose services and a full destination pane.

Widgets remain a future extension, not an implemented v1 feature. The icon picker starts with a curated local catalogue; maintainers can refresh it with `npm run icons -- /path/to/dashboard-icons`.
