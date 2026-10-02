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
- Titles use locally bundled Inter bold and app labels are 13 px. Apps without addresses keep full-brightness artwork; their tooltip explains why they cannot launch.
- **Settings → Import & backup** accepts YAML/JSON dashboard files, pane templates and Docker selections. Export a private backup before replacing a dashboard.
- Shared exports remove app URLs and Docker identity but retain uploaded images and image URLs. Review these before sharing. Blank-address tiles do not launch.
- Mobile is read-only, with panes/apps shown in reading order; desktop coordinates remain unchanged.

Autosave displays its state in the header. Save errors can be retried. A revision conflict requires reloading; save a backup first if you need to preserve the local draft.

## Upgrading existing dashboards

Appearance additions use optional fields in schema 2. Existing layouts keep their geometry and default solid panes; no migration is needed for this update. Export a full backup before updating, and reload old browser tabs afterwards. Older app versions cannot read the new appearance fields.

The layout format is now version 2; the product remains Pane v1. On first startup, the server converts an old configuration and saves its original bytes beside it as `pane.yaml.v1-*.bak`. App slots, IDs and intentional gaps are preserved. Pane positions are scaled consistently to accommodate the larger tiles and gutters, so the workspace may grow. Layouts beyond the supported limits fail safely without replacing the original file.

Old dashboard and pane-template exports are converted during import preview. Reload any browser tabs left open during the upgrade. To roll back, stop Pane, restore the original backup and run the previous application version.

## Personalise Pane

Open **Settings**. Changes stay in a draft as you move between sections. **Apply settings** saves the complete draft; closing or cancelling asks before discarding changes. The fixed action bar stays visible while the main content scrolls. Appearance covers Theme, Colours and Typography. Background is a separate sidebar page. Settings contain no miniature dashboard previews.

- **General:** set the **Dashboard name**, logo, workspace width and navigation labels. Under **Logo**, choose **Icon + name** for a square brandmark beside your name, or **Full logo** for rectangular artwork replacing both. Use a built-in icon, upload or HTTP(S) URL. Full logos fit within 280 × 48 px on desktop without cropping or stretching. Transparent PNGs with trimmed padding work well. The name still sets the browser title and accessible name; failed images fall back to the built-in icon/name.
- **Appearance → Theme:** choose Midnight or Daylight. Changing theme resets custom colours, preserving your background and pane finish.
- **Appearance → Colours:** select an accent swatch, or expand **Custom palette** to customise page, surface, text and accent colours. Text must meet 4.5:1 contrast against solid page and pane colours. **Reset colours** only resets the palette.
- **Appearance → Typography:** adjust pane-title size (14–22 px) using bundled Inter. Google Fonts and expanded font controls are deferred to [issue #3](https://github.com/Graphixa/Pane-Dashboard/issues/3).
- **Background:** choose static options (None, Dusk, Ocean, Forest, Mist, Custom) or animated Waves/Aurora. Custom reveals upload/URL controls only while selected. Overlay adds Dark/Light solid or gradient washes, or a custom colour, with opacity for contrast. Theme changes keep solid vs gradient unless Custom is selected. URLs load directly in your browser; use HTTPS URLs on HTTPS deployments. Waves and Aurora animation improvements are deferred to [issue #1](https://github.com/Graphixa/Pane-Dashboard/issues/1).
- **Panes:** choose one global Solid or Glass finish under **Pane finish**. When Glass is selected, **Fine tuning** provides opacity (30–100%) and blur (0–24 px). **Labels** controls whether app names appear beneath icons. Text and artwork stay opaque; reduced-transparency preferences and unsupported browsers use solid surfaces. This remains frosted glass; liquid-glass refinement is tracked in [issue #2](https://github.com/Graphixa/Pane-Dashboard/issues/2). There are no per-pane appearance overrides.
- **Import & backup:** import layouts or Docker selections, download a private backup, or export a shareable layout. Apply pending settings before importing or exporting to avoid mixing draft and saved data.
- **About:** installed version and repository/issue links.

Live changes on the dashboard behind Settings, without background blur and with Cancel restoring the prior state, are deferred to [issue #4](https://github.com/Graphixa/Pane-Dashboard/issues/4). Until then, the dashboard changes only when you apply.

### Uploaded images and backups

Accepts static PNG, JPEG and WebP files up to 8 MiB / 20 million pixels. The browser resizes icons to at most 512 × 512, logos to 1200 × 320, and backgrounds to 1920 × 1920, retaining aspect ratio. The server validates and re-encodes PNG/JPEG output, strips metadata and accepts at most 2 MiB per prepared image. SVG and GIF uploads are not supported.

Prepared images are embedded in `pane.yaml` only when you apply settings. There is no separate upload folder or orphan-file cleanup. The existing configuration volume therefore persists artwork too, and **Download full backup** includes it. Shared exports include artwork as well: review private logos/backgrounds before sharing. URL-based images remain URLs and are not downloaded into backups.

Configuration saves and imports are limited to 8 MiB. Upload preparation does not change the saved dashboard or revision. Keep any reverse proxy's request-size limit at least 8 MiB. Large uploaded backgrounds increase configuration and backup size; bounded embedded images favour simple, portable single-user backups over a separate asset database.

## Optional Docker import

Set `PANE_DOCKER_ENDPOINT` to `http://socket-proxy:2375` on an internal Docker network, or explicitly to `unix:///var/run/docker.sock`. Restart Pane, then open Settings → Import & backup → Docker. Only running containers are listed. Review the proposed name, icon and address, check the apps to import, and choose a new or existing pane.

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
