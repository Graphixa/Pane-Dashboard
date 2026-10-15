# Getting started with Pane

**You do not need Docker to test Pane locally.** Build the frontend once, then Go serves the entire app. Use the optional development server when you want frontend changes to appear immediately.

## 1. Install prerequisites

| Run directly on your computer | Run with Docker |
| --- | --- |
| [Git](https://git-scm.com/downloads/), [Node.js **24**](https://nodejs.org/en/download) (includes npm), [Go **1.26**](https://go.dev/doc/install) | Git and [Docker](https://docs.docker.com/get-started/get-docker/) with **Compose v2** |

On Windows/macOS, Docker Desktop includes Compose. On a Linux server, install Docker Engine and the Compose plugin. Docker builds install Node and Go inside the build environment; you do not need them on the host.

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

The repository is private: use a GitHub account with access and your normal Git authentication. If you already cloned it, open that folder and run `git pull --ff-only` instead.

All commands below start in the **Pane-Dashboard repository root**, unless stated otherwise.

## 3. Run locally — no Docker

Install dependencies and build the frontend:

```sh
cd web
npm ci
npm run build
cd ..
go mod download
```

Start the app using the commands for your terminal.

**Windows PowerShell:**

```powershell
$env:PANE_CONFIG = "./config/pane.yaml"
go run .
```

**macOS/Linux:**

```sh
PANE_CONFIG=./config/pane.yaml go run .
```

Open **http://127.0.0.1:8080**. Keep the terminal running; press **Ctrl+C** to stop.

Pane creates `config/pane.yaml` automatically and keeps your dashboard there. No database is needed. The default listen address is loopback only (`127.0.0.1:8080`), so Windows Firewall should not prompt. For LAN access without Docker, set `PANE_LISTEN=:8080` (and allow the firewall once if Windows asks).

Open **Settings → General → Logo** to choose **Icon + name** or a rectangular **Full logo**, using an upload or URL. **Appearance** groups Theme, Colours and Typography. **Background** shows a compact Current preview; **Change wallpaper** opens the Browse chooser (Colours, categories such as My media, Gradients, Nature and Space). **Panes** contains Pane finish, glass Fine tuning and app Labels. All panes share the same style. Change settings, then Apply to update the dashboard. Uploaded images are included in configuration backups; no extra Docker volume is needed. See [Personalise Pane](README.md#personalise-pane) for image limits and controls. Fonts and gradient backgrounds are bundled locally. Add a pane from the header, then move it on the 16 px grid or resize in whole app slots. Existing saved pane positions are preserved after updating.

### Optional: live frontend development

Leave Go running above. Open a **second terminal** in the repository root:

```sh
cd web
npm run dev -- --host 127.0.0.1
```

Open the address Vite prints, usually **http://127.0.0.1:5173**. Frontend edits refresh automatically; API requests go to the Go server on port 8080. You still need the initial frontend build above because Go embeds `web/dist` when it compiles.

- **Go changes:** stop and restart `go run .`.
- **Testing the built app on port 8080 after frontend changes:** run `npm run build` in `web`, then restart Go.
- **Dependency changes after pulling updates:** run `npm ci` in `web` and `go mod download` at the root again.

## 4. Build and run with Docker

From the repository root:

```sh
docker compose up -d --build
```

This builds the included `Dockerfile`, runs its tests, and starts Pane in the background. Open **http://localhost:8080**.

Useful commands:

```sh
docker compose logs -f pane
docker compose ps
docker compose stop
docker compose start
```

Press Ctrl+C to leave the log viewer; the container keeps running. Configuration lives in the Compose-managed `pane-config` volume and survives container rebuilds. **Do not use `docker compose down -v` unless you intend to delete that configuration.**

To build without starting anything, use `docker compose build`. To build the Dockerfile directly with a chosen image name, use `docker build -t pane-dashboard:local .`.

The local `config/pane.yaml` and Docker volume are separate. To move your dashboard between them, use **Settings → Import & backup → Download full backup**, then import that file in the other instance.

## 5. Deploy to a remote Linux server

The server needs **Git, Docker Engine and Compose v2**. It does not need Node or Go. It also needs permission to clone the private repository.

Connect to your server, then clone and build there:

```sh
ssh your-user@your-server
git clone https://github.com/Graphixa/Pane-Dashboard.git
cd Pane-Dashboard
docker compose up -d --build
docker compose ps
```

Replace `your-user` and `your-server` with your details. Open **http://YOUR-SERVER-IP:8080** from your trusted LAN or VPN. The same Docker commands from section 4 work on the server.

**Pane has no login.** The supplied Compose file publishes port 8080 on the server's interfaces. Restrict access to your trusted network; for internet access, put it behind an HTTPS reverse proxy with authentication. Do not expose port 8080 publicly.

For access through an SSH tunnel only, change the port mapping in `compose.yaml` to `127.0.0.1:8080:8080`, rerun `docker compose up -d`, then run this on your computer:

```sh
ssh -N -L 8080:127.0.0.1:8080 your-user@your-server
```

Open **http://127.0.0.1:8080** on your computer. Keep the SSH session open and stop any local Pane instance using that port first.

### Update a running deployment

Download a full backup from Settings first. Then, in the server's existing repository folder:

```sh
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=50 pane
```

Keep the same folder/project name so Compose reuses the existing volume. There is no published prebuilt image yet; this route builds on the target server and suits its CPU architecture automatically.

## Quick troubleshooting

This update uses tile-based pane sizes and fixed 80 px icons. **Add → Pane** creates a 4 × 1 pane immediately; resize its edges/corner and click **Add title** above it if wanted. Existing configurations upgrade automatically with an original `pane.yaml.v1-*.bak` backup in the same config directory. Reload open tabs after upgrading. See [upgrade details](README.md#upgrading-existing-dashboards) for rollback.

| Problem | Fix |
| --- | --- |
| `web/dist` is missing | Run `npm ci` and `npm run build` inside `web` before running Go. |
| Node/npm/Go command not found | Install the prerequisites, then reopen your terminal. |
| Port 8080 is busy | Stop the other app. For Docker, change the host mapping to `8081:8080` and open port 8081. |
| Windows Firewall asks about `pane-dashboard.exe` | Local runs should bind loopback and not prompt. If you set `PANE_LISTEN=:8080`, Allow once for a stable `go build -o pane-dashboard.exe` path, or Cancel (app still works on this PC). `go run` rebuilds to a new temp path each time, so Allow there does not stick. |
| Local permission error at `/config` | Set `PANE_CONFIG` using the local startup commands above. |
| Frontend opens but API requests fail | Keep Go running on port 8080 alongside Vite. |
| Docker discovery is disabled | Normal by default. See [optional Docker import](README.md#optional-docker-import) when you are ready to enable it. |

Docker discovery is not required to run Pane or add apps manually. Direct Docker socket access is privileged, including with a `:ro` mount; follow the README before enabling it.

For development checks, run `npm test` and `npm run build` in `web`, then `go test ./...` and `go vet ./...` at the root. See [VERIFICATION.md](VERIFICATION.md) for the remaining hands-on checks.
