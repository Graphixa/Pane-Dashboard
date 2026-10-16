# Repository layout

Pane is a single-user self-hosted launcher. The tree separates the Go server, React UI, and wallpaper catalogue pipeline.

```text
cmd/pane/                 Go entry (main only)
internal/
  api/                    HTTP routes and handlers
  config/                 Schema, store, appearance validation
  media/                  Upload store, posters, validation (no HTTP)
  builtin/                Embedded catalogue serve + data/
  docker/                 Opt-in Docker discovery
  archive/                Portable backup helpers
  ui/                     Embedded web/dist (populated by build)
web/                      React UI (Vite)
wallpapers/               Source art → npm run catalogue
docs/                     Contracts and plans
```

## Build order

1. `npm run catalogue` in `web` writes `internal/builtin/data/` and `web/public/media/builtin/`.
2. `npm run build` in `web` writes `web/dist/`.
3. Copy `web/dist` → `internal/ui/dist` (see `run.ps1` / CI / Dockerfile).
4. `go run ./cmd/pane` or `go build -o pane ./cmd/pane`.

`go test ./...` expects a staged `internal/ui/dist` (same as local run). CI builds the frontend and copies it before Go tests.

## Package boundaries

- `config` must not import `media`; `media` must not import `config`.
- `api` and `archive` may import both.
- Runtime config beside the binary lives under `/config/` (gitignored); that is not `internal/config/`.
