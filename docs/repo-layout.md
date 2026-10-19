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
  src/
    design/               Shared primitives (public entry: components.tsx)
    features/
      apps/               Add/Edit app, icon picker, catalogue helpers
      panes/              Pane editor
      settings/           Settings shell, pages, branding, background
    services/             Non-UI HTTP helpers (e.g. media stage/commit)
    utils/                Pure helpers (e.g. YAML download)
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

### Go

- `config` must not import `media`; `media` must not import `config`.
- `api` and `archive` may import both.
- Runtime config beside the binary lives under `/config/` (gitignored); that is not `internal/config/`.

### React feature ownership

- **Settings** (`features/settings/Settings.tsx`) is the single owner of the settings draft, current page, initial snapshot, recent wallpaper draft/history and session lifetime. Pages receive narrow values/callbacks; they must not create divergent full-config copies or save themselves. `SettingsFooter` presents status and calls supplied actions only.
- **Wallpaper chooser** may own local UI state (category, scroll/focus, opening snapshot). Authoritative wallpaper selection and recent history stay in the Settings-owned draft.
- **AppEditor** owns its draft and destination. **AppIconPicker** owns browsing/query/render-budget state and emits a catalogue entry. Catalogue metadata lives in `features/apps/appCatalogue.ts` (no React UI imports).
- **PaneEditor** does not import AppEditor internals. Shared YAML download lives in `utils/download.ts`.
- Media stage/commit HTTP helpers live in `services/media.ts` and must not import feature UI.

### Import rules

- Feature screens import interactive primitives only from `web/src/design/components.tsx`, never from `design/controls`, `design/overlays`, `design/colour` or other internal design files.
- Shared design primitives must not import feature components, config persistence or media network services.
- Model/pure helpers (`model.ts`, `appearance.ts`, `appCatalogue.ts`, `validation.ts`, `utils/*`) must not import UI components.
- Avoid circular imports. Do not add a second UI library, application-wide state framework or layout engine.
