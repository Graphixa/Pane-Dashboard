# Pane

A quiet home for your self-hosted apps. Arrange app panes on a fixed grid, leave intentional gaps, and lock everything in place when you are done.

**Start here: [Getting started](GETTING_STARTED.md)** — prerequisites, local testing without Docker (Windows/macOS/Linux), live development, Docker builds and remote deployment.

## Run with Docker

```sh
git clone https://github.com/Graphixa/Pane-Dashboard.git
cd Pane-Dashboard
docker compose up -d --build
```

Open `http://localhost:8080`. Configuration persists in the `pane-config` volume as `/config/pane.yaml`. The image runs as UID/GID 10001; a bind-mounted config directory must be writable by that user. This repository builds locally; no prebuilt registry image is published yet.

**Security:** Pane is single-user and has no login. Keep it on a trusted network or behind an authenticating reverse proxy. Edit mode prevents accidental interactions; it is not an access-control mechanism. Anyone who can reach the API can read and edit configuration.

## Using Pane

- **Add → Pane** immediately creates an untitled 4-column × 1-row pane and selects it in edit mode.
- **Edit / Done** unlocks and locks layout interactions. Drag the pane's move handle, or focus it and use arrow keys. Resize from the right, bottom or bottom-right corner in whole app slots; placeholders update while dragging.
- Optional titles sit above their pane. Click **Add title** or an existing title in edit mode; Enter or clicking away saves, Escape cancels. Titles stay attached when moving the pane.
- In edit mode, click an empty slot to add an app, or click an app to edit it. Drag apps into empty slots, including across panes. Numeric controls are available for keyboard users.
- Panes never push neighbours, apps never swap, and resizing stops before occupied slots would be clipped.
- Icons use a fixed 80 px size, with matching square placeholders, inner padding and 16 px gutters between panes. Pane settings specify app columns and rows.
- **Settings** controls workspace width, theme, app labels and navigation labels. Changes that clip panes are rejected.
- **Settings → Import** accepts YAML/JSON dashboard files, pane templates and Docker selections. Export a private backup before replacing a dashboard.
- Shared exports remove app URLs and Docker identity. Review custom icon URLs before sharing. Blank-address tiles do not launch.
- Mobile is read-only, with panes/apps shown in reading order; desktop coordinates remain unchanged.

Autosave displays its state in the header. Save errors can be retried. A revision conflict requires reloading; save a backup first if you need to preserve the local draft.

## Upgrading existing dashboards

The layout format is now version 2; the product remains Pane v1. On first startup, the server converts an old configuration and saves its original bytes beside it as `pane.yaml.v1-*.bak`. App slots, IDs and intentional gaps are preserved. Pane positions are scaled consistently to accommodate the larger tiles and gutters, so the workspace may grow. Layouts beyond the supported limits fail safely without replacing the original file.

Old dashboard and pane-template exports are converted during import preview. Reload any browser tabs left open during the upgrade. To roll back, stop Pane, restore the original backup and run the previous application version.

## Optional Docker import

Set `PANE_DOCKER_ENDPOINT` to `http://socket-proxy:2375` on an internal Docker network, or explicitly to `unix:///var/run/docker.sock`. Restart Pane, then open Settings → Import → Docker. Only running containers are listed. Review the proposed name, icon and address, check the apps to import, and choose a new or existing pane.

Prefer a restricted Docker API proxy allowing only `GET /version` and `GET /v*/containers/json`. Some standard socket proxies grant broader read categories; review their rules. Do not publish the proxy port to your LAN or the internet. Pane does not pass arbitrary paths or execute container-management operations.

**Mounting `/var/run/docker.sock:ro` does not make Docker API access read-only.** A compromised process with socket access can control the host. Direct socket use is advanced, opt-in deployment: mount the socket and grant its numeric group to the non-root Pane user only after accepting this risk. No socket mount is included by default.

Published ports are suggestions, not verified web interfaces. Enter the host's reachable hostname/IP. Correct HTTPS, reverse-proxy, host-networking or multiple-port addresses manually. Container IDs are not used for deduplication; Compose project/service or container names are scoped to the configured endpoint. Changing that endpoint can change discovery identity.

## Development

Requires Node 24 and Go 1.23+ (CI uses Go 1.26).

```sh
cd web
npm ci
npm run build
cd ..
PANE_CONFIG=./config/pane.yaml go run .
```

For frontend hot reload, run `npm run dev` in `web` in a second terminal. Vite proxies `/api` to the Go server on port 8080. Build the frontend once before compiling Go because the frontend is embedded.

```sh
cd web
npm test
npm run build
cd ..
go test -race ./...
go vet ./...
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PANE_CONFIG` | `/config/pane.yaml` | Configuration file |
| `PANE_LISTEN` | `:8080` | HTTP listen address |
| `PANE_DOCKER_ENDPOINT` | unset | Opt-in Docker socket/proxy |

The frontend uses React Grid Layout 2.2.4 for outer geometry and CSS Grid for app slots. Icons are fetched directly from the [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) catalogue through jsDelivr, or a user-specified HTTP(S) URL. Icon availability requires connectivity; letter fallbacks work offline. Trademarks belong to their owners. No icon artwork is bundled.

The root [SPEC.md](SPEC.md) defines behaviour and scope. [AGENTS.md](AGENTS.md) gives coding-agent instructions. Widgets, mobile editing, accounts and multi-dashboard support are intentionally outside v1. Full width adds workspace without stretching tiles. Narrow screens show a read-only layout without changing saved positions.
