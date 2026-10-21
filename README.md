# Pane

A design-first homepage for your self-hosted apps.

## Description

Pane is a design-first homepage for your self-hosted apps. Its setup is done in the browser with built-in editors — no hand-editing config files to build or restyle your dashboard. Arrange apps in panes on a fixed grid, leave gaps or fill the board, and lock the layout when you are done.

It sits between messy bookmarks and overcomplicated dashboards: polished by default (themes, live wallpapers, screen effects), whether you want a minimal board or a dense one. Share layout templates without private URLs, or import running containers from Docker when you are just getting started.

> [!IMPORTANT]
> Pane has **no login**. Keep it on a trusted network or behind an authenticating reverse proxy. Edit mode only prevents accidental clicks; anyone who can reach the API can read and edit configuration.



## Functionality

- Create and arrange panes and apps in the browser (edit mode, then lock with Done)
- Fixed grid with intentional gaps — panes never push neighbours; apps never swap
- Themes, live wallpapers and screen effects with a live settings preview
- Import & backup: private backups, shareable layouts (addresses stripped)
- Optional Docker import to discover running containers and add them as apps
- Autosave; mobile is read-only



## Installation



### With Docker (recommended)

> [!NOTE]
> No prebuilt registry image is published yet. Compose builds from GitHub (first run can take a few minutes). When an image is published, replace `build` with `image: ghcr.io/...`.



#### Docker Compose

```yaml
services:
  pane:
    build: https://github.com/Graphixa/Pane-Dashboard.git
    image: pane:local
    container_name: pane
    ports:
      - 7775:7775
    volumes:
      - /path/to/config:/config # Make sure your local config directory exists
      - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For Docker import
    environment:
      PUID: 1000 # match your host user: id -u
      PGID: 1000 # match your host group: id -g
      # DOCKER_HOST: unix:///var/run/docker.sock # required if the socket volume above is enabled
    restart: unless-stopped
```

```sh
docker compose up -d --build
```

Open **[http://localhost:7775](http://localhost:7775)**.

Set `PUID` / `PGID` to your host user (`id -u` / `id -g`) so the config directory is writable.

> [!WARNING]
> Mounting `/var/run/docker.sock:ro` does **not** make the Docker API read-only. Prefer a restricted socket proxy when you can. See [Docker import](#docker-import).



#### Docker run

```sh
docker build -t pane:local https://github.com/Graphixa/Pane-Dashboard.git
docker run -d \
  --name=pane \
  -p 7775:7775 \
  -v /path/to/config:/config \
  -e PUID=1000 \
  -e PGID=1000 \
  --restart unless-stopped \
  pane:local
```



### Without Docker

Build the frontend and run Go on your machine (Node 24, Go 1.26, FFmpeg). Full steps: [Getting started](GETTING_STARTED.md).

## Configuration


| Name          | Default                  | Description                                                                            |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `PUID`        | unset (root)             | User ID for `/config` and the Pane process. Set to your host UID.                      |
| `PGID`        | `PUID`                   | Group ID for `/config` and the Pane process.                                           |
| `UMASK`       | `002` when `PUID` is set | File creation mask.                                                                    |
| `DOCKER_HOST` | unset                    | Docker socket or HTTP(S) proxy for Docker import (e.g. `unix:///var/run/docker.sock`). |
| `PANE_CONFIG` | `/config/pane.yaml`      | Config file path (leave unset in Docker).                                              |
| `PANE_LISTEN` | `:7775` in the image     | Listen address (leave unset in Docker).                                                |



| Volume                 | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `/config`              | `pane.yaml` and `media/`                         |
| `/var/run/docker.sock` | Optional. Docker import (also set `DOCKER_HOST`) |




## Docker import

With `DOCKER_HOST` set (and the socket or proxy available), open **Settings → Import & backup → Docker**, scan running containers, and add apps to a pane.

Prefer a restricted Docker API proxy allowing only `GET /version` and `GET /v*/containers/json` on an internal network. Do not publish a proxy to your LAN or the internet. Published ports are suggestions, not verified web UIs — check addresses before saving.

More detail: [Getting started](GETTING_STARTED.md#optional-docker-import).

## Updating

1. Download a full backup from **Settings → Import & backup**.
2. Rebuild and recreate:

```sh
docker compose up -d --build
```



## Development

Requires Node 24, Go 1.26 (CI), and FFmpeg for bundled wallpaper thumbnails. Docker builds install these automatically.

Local run, live frontend, remote deploy and troubleshooting: **[Getting started](GETTING_STARTED.md)**.

[SPEC.md](SPEC.md) · [DESIGN.md](DESIGN.md) · [AGENTS.md](AGENTS.md)