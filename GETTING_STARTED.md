# Getting started with Pane

**You do not need Docker to test Pane locally.** Build the frontend once, then Go serves the entire app. Use the optional development server when you want frontend changes to appear immediately.

For a short product overview and Docker Quick Start, see the [README](README.md).

## 1. Install prerequisites

| Run directly on your computer | Run with Docker |
| --- | --- |
| [Git](https://git-scm.com/downloads/), [Node.js **24**](https://nodejs.org/en/download) (includes npm), [Go **1.26**](https://go.dev/doc/install), [FFmpeg](https://ffmpeg.org/download.html) | Git and [Docker](https://docs.docker.com/get-started/get-docker/) with **Compose v2** |

On Windows/macOS, Docker Desktop includes Compose. On a Linux server, install Docker Engine and the Compose plugin. FFmpeg generates the small bundled wallpaper thumbnails during builds. On macOS use `brew install ffmpeg`; on Ubuntu/Debian use `sudo apt install ffmpeg`; on Windows install FFmpeg and add its `bin` folder to PATH. Check `ffmpeg -version` before building. Docker builds install Node, Go and FFmpeg inside the build environment; you do not need them on the host.

Check your tools in a new terminal after installation:

```sh
git --version
node --version
npm --version
go version
```

For the Docker route, check `docker version` and `docker compose version` instead of Node/npm/Go. Docker must be running.

## 2. Get the code

```sh
git clone https://github.com/Graphixa/Pane-Dashboard.git
cd Pane-Dashboard
```

If you already cloned it, open that folder and run `git pull --ff-only` instead. For Docker without cloning, see [README Installation](README.md#installation) (`build` from the GitHub URL).

All commands below start in the **Pane-Dashboard repository root**, unless stated otherwise.

## 3. Run locally — no Docker

Install dependencies and build the frontend:

```sh
cd web
npm ci
npm run build
cd ..
cp -r web/dist internal/ui/dist
go mod download
```

The Go server embeds the frontend from `internal/ui/dist`, so copy the build output there after each `npm run build` (on Windows PowerShell: `Copy-Item -Recurse -Force web/dist internal/ui/dist`).

Start the app using the commands for your terminal.

**Windows PowerShell:**

```powershell
$env:PANE_CONFIG = "./config/pane.yaml"
go run ./cmd/pane
```

**macOS/Linux:**

```sh
PANE_CONFIG=./config/pane.yaml go run ./cmd/pane
```

Open **http://127.0.0.1:7775**. Keep the terminal running; press **Ctrl+C** to stop.

Pane creates `config/pane.yaml` automatically and keeps your dashboard there. No database is needed. The default listen address is loopback only (`127.0.0.1:7775`), so Windows Firewall should not prompt. For LAN access without Docker, set `PANE_LISTEN=:7775` (and allow the firewall once if Windows asks).

### Optional: live frontend development

Leave Go running above. Open a **second terminal** in the repository root:

```sh
cd web
npm run dev -- --host 127.0.0.1
```

Open the address Vite prints, usually **http://127.0.0.1:5173**. Frontend edits refresh automatically; API requests go to the Go server on port 7775. You still need the initial frontend build above because Go embeds `internal/ui/dist` when it compiles.

- **Go changes:** stop and restart `go run ./cmd/pane`.
- **Testing the built app on port 7775 after frontend changes:** run `npm run build` in `web`, copy `web/dist` to `internal/ui/dist`, then restart Go.
- **Dependency changes after pulling updates:** run `npm ci` in `web` and `go mod download` at the root again.

## 4. Build and run with Docker

Copy-paste compose and `docker run` examples: [README Installation](README.md#installation) and [Configuration](README.md#configuration).

From the repository root (see also [README Installation](README.md#installation)):

```sh
docker compose up -d --build
```

Open **http://localhost:7775**. Set `PUID` / `PGID` in `compose.yaml` to your host user. Configuration lives in `./config` (or whatever you mount at `/config`).

Useful commands:

```sh
docker compose logs -f pane
docker compose ps
docker compose stop
docker compose start
```

To build without starting anything, use `docker compose build`. To build the Dockerfile directly: `docker build -t pane:local .`.

Native `PANE_CONFIG=./config/pane.yaml` and the Docker `./config:/config` mount can share the same files. Use **Settings → Import & backup → Download full backup** if you need to move a dashboard between separate directories.

## 5. Deploy to a remote Linux server

The server needs **Docker Engine and Compose v2**. It does not need Node or Go. Prefer the [README](README.md#installation) compose file that builds from GitHub. Or clone and use the repo `compose.yaml`:

```sh
ssh your-user@your-server
git clone https://github.com/Graphixa/Pane-Dashboard.git
cd Pane-Dashboard
docker compose up -d --build
docker compose ps
```

Open **http://YOUR-SERVER-IP:7775** from your trusted LAN or VPN.

> [!IMPORTANT]
> Pane has no login. The Compose file publishes port 7775 on the server's interfaces. Restrict access to your trusted network; for internet access, put it behind an HTTPS reverse proxy with authentication. Do not expose port 7775 publicly.

For access through an SSH tunnel only, change the port mapping in `compose.yaml` to `127.0.0.1:7775:7775`, rerun `docker compose up -d`, then on your computer:

```sh
ssh -N -L 7775:127.0.0.1:7775 your-user@your-server
```

Open **http://127.0.0.1:7775**. Keep the SSH session open and stop any local Pane instance using that port first.

### Update a running deployment

Download a full backup from Settings first, then:

```sh
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=50 pane
```

There is no published prebuilt image yet; this route builds on the target server.

## Personalise Pane

Open **Settings**. Changes stay in a draft as you move between sections and preview live on the dashboard and inside Settings. **Apply settings** saves the complete draft; closing or cancelling asks before discarding and restores the previous look. Settings opens without a dimmed lightbox so dashboard colours stay true; a soft drop shadow lifts the dialog above the shell. The fixed action bar stays visible while the main content scrolls. Appearance covers Theme, Colours and Typography. Background is a separate sidebar page. Settings contain no miniature dashboard previews.

- **General:** set the **Page title** (with Show/Hide), **Icon** (inline 2×6 built-in grid plus a square custom upload, with Show/Hide), **Custom logo** (inline dropzone; From URL under the label), workspace width and navigation labels. Custom logos fit within 280 × 48 px on desktop without cropping or stretching. Transparent PNGs with trimmed padding work well. The page title string still sets the browser title and accessible name; failed custom icons fall back to the built-in mark, and failed logos fall back to the title when it is shown.
- **Appearance → Theme:** choose Midnight or Daylight. Changing theme resets custom colours, preserving your background and pane finish.
- **Appearance → Colours:** select an accent swatch, or expand **Custom palette** to customise page, surface, text and accent colours. Text must meet 4.5:1 contrast against solid page and pane colours. **Reset colours** only resets the palette.
- **Appearance → Typography:** choose Geist, Rubik or Oxanium (Geist default) and adjust pane-title size (14–22 px). Google Fonts import remains deferred to [issue #3](https://github.com/Graphixa/Pane-Dashboard/issues/3).
- **Background:** compact Current band, Change wallpaper chooser (Colours, My media, Gradients, bundled categories), Enhancements and Readability. See [docs/background-media-contracts.md](docs/background-media-contracts.md) and [AGENTS.md](AGENTS.md) for the full Background behaviour.
- **Panes:** choose one global Solid or Glass finish under **Pane finish**. When Glass is selected, **Fine tuning** provides opacity, blur, saturation, displacement and chromatic aberration. Glass uses a clear theme-toned wash with edge refraction where supported (Chromium), automatically falling back to frost-only for Firefox/Safari, reduced motion/transparency, offscreen panes, or while dragging ([issue #2](https://github.com/Graphixa/Pane-Dashboard/issues/2)). **Labels** controls whether app names appear beneath icons. Text and artwork stay opaque. There are no per-pane appearance overrides.
- **Import & backup:** import layouts or Docker selections, download a private backup, or export a shareable layout. Apply pending settings before importing or exporting to avoid mixing draft and saved data.
- **About:** installed version and repository/issue links.

Draft settings preview live on the dashboard behind Settings; Cancel restores the prior state ([issue #4](https://github.com/Graphixa/Pane-Dashboard/issues/4)). Apply still validates and saves through the ordinary revision-protected flow.

### Uploaded media and backups

Accepts PNG, JPEG and WebP images plus muted WebM/MP4 loops within the limits in [docs/background-media-contracts.md](docs/background-media-contracts.md). Uploads stage and commit through `/api/media/*` into a `media/` directory beside the configuration; `pane.yaml` stores references only (never embedded bytes). SVG, GIF, animated WebP and arbitrary CSS/HTML uploads are rejected. Disk GC removes unreferenced assets after a successful Apply. Portable archives include referenced local media; remote image URLs remain links and are never fetched by the backend.

## Upgrading existing dashboards

Export a full backup before updating, and reload old browser tabs afterwards.

On first startup, the server converts an older configuration when required and may save original bytes beside it as a `.bak` file. App slots, IDs and intentional gaps are preserved where migration applies. Layouts beyond supported limits fail safely without replacing the original file.

Old dashboard and pane-template exports are converted during import preview. To roll back, stop Pane, restore the original backup and run the previous application version.

## Optional Docker import

Set `DOCKER_HOST` to `http://socket-proxy:2375` on an internal Docker network, or explicitly to `unix:///var/run/docker.sock`. Restart Pane, then open Settings → Import & backup → Docker. Only running containers are listed. Review the proposed name, icon and address, check the apps to import, and choose a new or existing pane.

Prefer a restricted Docker API proxy allowing only `GET /version` and `GET /v*/containers/json`. Some standard socket proxies grant broader read categories; review their rules. Do not publish the proxy port to your LAN or the internet. Pane does not pass arbitrary paths or execute container-management operations.

> [!WARNING]
> Mounting `/var/run/docker.sock:ro` does **not** make Docker API access read-only. A compromised process with socket access can control the host. Direct socket use is advanced, opt-in deployment: mount the socket and ensure the container user can access it only after accepting this risk. No socket mount is included by default.

Published ports are suggestions, not verified web interfaces. Enter the host's reachable hostname/IP. Correct HTTPS, reverse-proxy, host-networking or multiple-port addresses manually. Container IDs are not used for deduplication; Compose project/service or container names are scoped to the configured endpoint. Changing that endpoint can change discovery identity.

## Quick troubleshooting

| Problem | Fix |
| --- | --- |
| `internal/ui/dist` is missing | Run `npm ci` and `npm run build` inside `web`, then copy `web/dist` to `internal/ui/dist`, before running Go. |
| Node/npm/Go command not found | Install the prerequisites, then reopen your terminal. |
| Port 7775 is busy | Stop the other app. For Docker, change the host mapping to `7776:7775` and open port 7776. |
| Permission denied writing `/config` | Set `PUID` / `PGID` to your host user (`id -u` / `id -g`). |
| Windows Firewall asks about `pane-dashboard.exe` | Local runs should bind loopback and not prompt. If you set `PANE_LISTEN=:7775`, Allow once for a stable `go build -o pane-dashboard.exe ./cmd/pane` path, or Cancel (app still works on this PC). `go run` rebuilds to a new temp path each time, so Allow there does not stick. |
| Local permission error at `/config` | Set `PANE_CONFIG` using the local startup commands above. |
| Frontend opens but API requests fail | Keep Go running on port 7775 alongside Vite. |
| Docker discovery is disabled | Normal by default. Set `DOCKER_HOST` when you are ready; see [optional Docker import](#optional-docker-import). |

Docker discovery is not required to run Pane or add apps manually.

For development checks, run `npm test` and `npm run build` in `web`, copy `web/dist` to `internal/ui/dist`, then `go test ./...` and `go vet ./...` at the root. See [docs/repo-layout.md](docs/repo-layout.md).

## UI development

Read [DESIGN.md](DESIGN.md) before changing the interface. Shared tokens and React components live in `web/src/design`. Run `npm run dev` in `web` and open `/design-system.html` on the Vite server to inspect the component reference. The same page is included in production builds and uses sample data without reading or saving dashboard configuration.
