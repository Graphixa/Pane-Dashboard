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
- Movement snaps to a fainter 16 px grid. Existing saved positions stay unchanged until moved. The dotted move grip sits at the top centre of each pane. Offset vertical, horizontal and L-shaped resize marks appear on hover, focus or selection. The edit grid fills the remaining screen height and grows with your layout.
- **Settings** uses a sidebar: General, Appearance, Background, Panes, Import & backup, and About. Changes that clip panes are rejected.
- Titles use the selected bundled UI font (Geist by default; Rubik and Oxanium also available) in bold, and app labels are 13 px. Apps without addresses keep full-brightness artwork; their tooltip explains why they cannot launch.
- **Settings → Import & backup** accepts YAML/JSON dashboard files, pane templates and Docker selections. Export a private backup before replacing a dashboard.
- Shared exports remove app URLs and Docker identity but retain uploaded images and image URLs. Review these before sharing. Blank-address tiles do not launch.
- Mobile is read-only, with panes/apps shown in reading order; desktop coordinates remain unchanged.

Autosave displays its state in the header. Save errors can be retried. A revision conflict requires reloading; save a backup first if you need to preserve the local draft.

## Upgrading existing dashboards

Appearance additions use optional fields in schema 2. Existing layouts keep their geometry and default solid panes; no migration is needed for this update. Export a full backup before updating, and reload old browser tabs afterwards. Older app versions cannot read the new appearance fields.

The layout format is now version 2; the product remains Pane v1. On first startup, the server converts an old configuration and saves its original bytes beside it as `pane.yaml.v1-*.bak`. App slots, IDs and intentional gaps are preserved. Pane positions are scaled consistently to accommodate the larger tiles and gutters, so the workspace may grow. Layouts beyond the supported limits fail safely without replacing the original file.

Old dashboard and pane-template exports are converted during import preview. Reload any browser tabs left open during the upgrade. To roll back, stop Pane, restore the original backup and run the previous application version.

## Personalise Pane

Open **Settings**. Changes stay in a draft as you move between sections and preview live on the dashboard and inside Settings. **Apply settings** saves the complete draft; closing or cancelling asks before discarding and restores the previous look. Settings opens without a dimmed lightbox so dashboard colours stay true; a soft drop shadow lifts the dialog above the shell. The fixed action bar stays visible while the main content scrolls. Appearance covers Theme, Colours and Typography. Background is a separate sidebar page. Settings contain no miniature dashboard previews.

- **General:** set the **Page title** (with Show/Hide), **Icon** (inline 2×6 built-in grid plus a square custom upload, with Show/Hide), **Custom logo** (inline dropzone; From URL under the label), workspace width and navigation labels. Custom logos fit within 280 × 48 px on desktop without cropping or stretching. Transparent PNGs with trimmed padding work well. The page title string still sets the browser title and accessible name; failed custom icons fall back to the built-in mark, and failed logos fall back to the title when it is shown.
- **Appearance → Theme:** choose Midnight or Daylight. Changing theme resets custom colours, preserving your background and pane finish.
- **Appearance → Colours:** select an accent swatch, or expand **Custom palette** to customise page, surface, text and accent colours. Text must meet 4.5:1 contrast against solid page and pane colours. **Reset colours** only resets the palette.
- **Appearance → Typography:** choose Geist, Rubik or Oxanium (Geist default) and adjust pane-title size (14–22 px). Google Fonts import remains deferred to [issue #3](https://github.com/Graphixa/Pane-Dashboard/issues/3).
- **Background:** choose static options (None, Dusk, Ocean, Forest, Mist, Custom) or animated Waves/Aurora. Custom reveals upload/URL controls only while selected. Overlay adds Dark/Light solid or gradient washes, or a custom colour, with opacity for contrast. Theme changes keep solid vs gradient unless Custom is selected. URLs load directly in your browser; use HTTPS URLs on HTTPS deployments. Waves and Aurora animation improvements are deferred to [issue #1](https://github.com/Graphixa/Pane-Dashboard/issues/1).
- **Panes:** choose one global Solid or Glass finish under **Pane finish**. When Glass is selected, **Fine tuning** provides opacity, blur, saturation, displacement and chromatic aberration. Glass uses a clear theme-toned wash with edge refraction where supported (Chromium), automatically falling back to frost-only for Firefox/Safari, reduced motion/transparency, offscreen panes, or while dragging ([issue #2](https://github.com/Graphixa/Pane-Dashboard/issues/2)). **Labels** controls whether app names appear beneath icons. Text and artwork stay opaque. There are no per-pane appearance overrides.
- **Import & backup:** import layouts or Docker selections, download a private backup, or export a shareable layout. Apply pending settings before importing or exporting to avoid mixing draft and saved data.
- **About:** installed version and repository/issue links.

Draft settings preview live on the dashboard behind Settings without backdrop blur; Cancel restores the prior state ([issue #4](https://github.com/Graphixa/Pane-Dashboard/issues/4)). Apply still validates and saves through the ordinary revision-protected flow.

### Uploaded media and backups

Accepts PNG, JPEG and WebP images plus muted WebM/MP4 loops within the limits in [docs/background-media-contracts.md](docs/background-media-contracts.md). Uploads stage and commit through `/api/media/*` into a `media/` directory beside the configuration; `pane.yaml` stores references only (never embedded bytes). SVG, GIF, animated WebP and arbitrary CSS/HTML uploads are rejected. Disk GC removes unreferenced assets after a successful Apply. Portable archives include referenced local media; remote image URLs remain links and are never fetched by the backend.

## Optional Docker import

Set `PANE_DOCKER_ENDPOINT` to `http://socket-proxy:2375` on an internal Docker network, or explicitly to `unix:///var/run/docker.sock`. Restart Pane, then open Settings → Import & backup → Docker. Only running containers are listed. Review the proposed name, icon and address, check the apps to import, and choose a new or existing pane.

Prefer a restricted Docker API proxy allowing only `GET /version` and `GET /v*/containers/json`. Some standard socket proxies grant broader read categories; review their rules. Do not publish the proxy port to your LAN or the internet. Pane does not pass arbitrary paths or execute container-management operations.

**Mounting `/var/run/docker.sock:ro` does not make Docker API access read-only.** A compromised process with socket access can control the host. Direct socket use is advanced, opt-in deployment: mount the socket and grant its numeric group to the non-root Pane user only after accepting this risk. No socket mount is included by default.

Published ports are suggestions, not verified web interfaces. Enter the host's reachable hostname/IP. Correct HTTPS, reverse-proxy, host-networking or multiple-port addresses manually. Container IDs are not used for deduplication; Compose project/service or container names are scoped to the configured endpoint. Changing that endpoint can change discovery identity.

## Development

Requires Node 24, Go 1.23+ (CI uses Go 1.26), and FFmpeg on PATH to generate bundled wallpaper thumbnails. Docker installs these build dependencies automatically.

```sh
cd web
npm ci
npm run build
cd ..
cp -r web/dist internal/ui/dist
PANE_CONFIG=./config/pane.yaml go run ./cmd/pane
```

For frontend hot reload, run `npm run dev` in `web` in a second terminal. Vite proxies `/api` to the Go server on port 8080. Build the frontend once and copy `web/dist` to `internal/ui/dist` before compiling Go because the frontend is embedded.

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
| `PANE_LISTEN` | `127.0.0.1:8080` | HTTP listen address (loopback by default; use `:8080` for all interfaces — Docker image sets this) |
| `PANE_DOCKER_ENDPOINT` | unset | Opt-in Docker socket/proxy |

The frontend uses React Grid Layout 2.2.4 for outer geometry and CSS Grid for app slots. A full native [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) index is bundled for search; artwork is fetched from a pinned jsDelivr ref, or a user-specified HTTP(S) URL. Icon availability requires connectivity; letter fallbacks work offline. The upstream project is Apache-2.0; trademarks belong to their owners. No icon artwork is bundled.

The root [SPEC.md](SPEC.md) defines behaviour and scope. [AGENTS.md](AGENTS.md) gives coding-agent instructions. Widgets, mobile editing, accounts and multi-dashboard support are intentionally outside v1. Full width adds workspace without stretching tiles. Narrow screens show a read-only layout without changing saved positions.


## UI development

Read [DESIGN.md](DESIGN.md) before changing the interface. Shared tokens and React components live in `web/src/design`. Run `npm run dev` in `web` and open `/design-system.html` on the Vite server to inspect the component reference. The same page is included in production builds and uses sample data without reading or saving dashboard configuration.
