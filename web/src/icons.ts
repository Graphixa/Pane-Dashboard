/** Curated Dashboard Icons entry with a stable slug and UI display name. */
export type CatalogueEntry = {
  slug: string;
  displayName: string;
  /** Optional extra search terms; not shown as the tile label. */
  aliases?: readonly string[];
};

/**
 * Curated local catalogue. Stored icon references remain `dashboard-icons:<slug>`.
 * Display names are intentional product casing for blank Name autofill only.
 */
export const catalogueEntries: readonly CatalogueEntry[] = [
  { slug: "adguard-home", displayName: "AdGuard Home", aliases: ["adguard"] },
  { slug: "audiobookshelf", displayName: "Audiobookshelf" },
  { slug: "authelia", displayName: "Authelia" },
  { slug: "authentik", displayName: "Authentik" },
  { slug: "bazarr", displayName: "Bazarr" },
  { slug: "bitwarden", displayName: "Bitwarden" },
  { slug: "calibre", displayName: "Calibre" },
  { slug: "cloudflare", displayName: "Cloudflare" },
  { slug: "code-server", displayName: "code-server" },
  { slug: "deluge", displayName: "Deluge" },
  { slug: "docker", displayName: "Docker" },
  { slug: "dozzle", displayName: "Dozzle" },
  { slug: "esphome", displayName: "ESPHome" },
  { slug: "filebrowser", displayName: "File Browser" },
  { slug: "firefly-iii", displayName: "Firefly III" },
  { slug: "freshrss", displayName: "FreshRSS" },
  { slug: "gitea", displayName: "Gitea" },
  { slug: "github", displayName: "GitHub" },
  { slug: "gitlab", displayName: "GitLab" },
  { slug: "glances", displayName: "Glances" },
  { slug: "grafana", displayName: "Grafana" },
  { slug: "guacamole", displayName: "Guacamole" },
  { slug: "heimdall", displayName: "Heimdall" },
  {
    slug: "home-assistant",
    displayName: "Home Assistant",
    aliases: ["hass", "ha"],
  },
  { slug: "homarr", displayName: "Homarr" },
  { slug: "homepage", displayName: "Homepage" },
  { slug: "immich", displayName: "Immich" },
  { slug: "jackett", displayName: "Jackett" },
  { slug: "jellyfin", displayName: "Jellyfin" },
  { slug: "jellyseerr", displayName: "Jellyseerr" },
  { slug: "joplin", displayName: "Joplin" },
  { slug: "kavita", displayName: "Kavita" },
  { slug: "lidarr", displayName: "Lidarr" },
  { slug: "mealie", displayName: "Mealie" },
  { slug: "minio", displayName: "MinIO" },
  { slug: "mosquitto", displayName: "Mosquitto" },
  { slug: "nextcloud", displayName: "Nextcloud" },
  {
    slug: "nginx-proxy-manager",
    displayName: "Nginx Proxy Manager",
    aliases: ["npm"],
  },
  { slug: "nodered", displayName: "Node-RED", aliases: ["node-red"] },
  { slug: "omada", displayName: "Omada" },
  { slug: "open-webui", displayName: "Open WebUI" },
  { slug: "opnsense", displayName: "OPNsense" },
  { slug: "overseerr", displayName: "Overseerr" },
  { slug: "paperless-ngx", displayName: "Paperless-ngx" },
  { slug: "pihole", displayName: "Pi-hole", aliases: ["pi-hole", "pi hole"] },
  { slug: "plex", displayName: "Plex" },
  { slug: "portainer", displayName: "Portainer" },
  { slug: "prometheus", displayName: "Prometheus" },
  { slug: "prowlarr", displayName: "Prowlarr" },
  { slug: "proxmox", displayName: "Proxmox" },
  { slug: "qbittorrent", displayName: "qBittorrent", aliases: ["qbit"] },
  { slug: "radarr", displayName: "Radarr" },
  { slug: "redis", displayName: "Redis" },
  { slug: "sabnzbd", displayName: "SABnzbd" },
  { slug: "searxng", displayName: "SearXNG" },
  { slug: "sonarr", displayName: "Sonarr" },
  { slug: "speedtest-tracker", displayName: "Speedtest Tracker" },
  { slug: "syncthing", displayName: "Syncthing" },
  { slug: "tautulli", displayName: "Tautulli" },
  { slug: "traefik", displayName: "Traefik" },
  { slug: "transmission", displayName: "Transmission" },
  { slug: "truenas", displayName: "TrueNAS" },
  { slug: "unifi", displayName: "UniFi" },
  { slug: "uptime-kuma", displayName: "Uptime Kuma" },
  { slug: "vaultwarden", displayName: "Vaultwarden" },
  { slug: "vikunja", displayName: "Vikunja" },
  { slug: "watchtower", displayName: "Watchtower" },
  { slug: "wikijs", displayName: "Wiki.js", aliases: ["wikijs", "wiki.js"] },
  { slug: "wireguard", displayName: "WireGuard" },
  { slug: "wordpress", displayName: "WordPress" },
  { slug: "yacht", displayName: "Yacht" },
];

/** Derived slug list for Docker recognition and existing slug consumers. */
export const catalogue: readonly string[] = catalogueEntries.map(
  (entry) => entry.slug,
);

export function catalogueEntry(slug: string): CatalogueEntry | undefined {
  return catalogueEntries.find((entry) => entry.slug === slug);
}

export function catalogueMatchesQuery(
  entry: CatalogueEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.slug.includes(q) || entry.displayName.toLowerCase().includes(q)) {
    return true;
  }
  return Boolean(entry.aliases?.some((alias) => alias.toLowerCase().includes(q)));
}

/**
 * Apply a catalogue tile selection: always set the icon; fill Name only when blank
 * (empty or whitespace-only). Preserve every other field byte-for-byte.
 */
export function applyCatalogueTileSelection<
  T extends { name: string; icon: string },
>(previous: T, entry: Pick<CatalogueEntry, "slug" | "displayName">): T {
  return {
    ...previous,
    icon: `dashboard-icons:${entry.slug}`,
    name:
      previous.name.trim() === "" ? entry.displayName : previous.name,
  };
}

export const iconURL = (icon: string) =>
  icon.startsWith("dashboard-icons:")
    ? `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${icon.slice(16)}.svg`
    : icon;

export function suggestIcon(name: string, image = "") {
  for (const s of [name, image.split("/").at(-1)?.split(":")[0] || ""]) {
    const slug = s.toLowerCase().replaceAll("_", "-");
    if (catalogue.includes(slug)) return `dashboard-icons:${slug}`;
  }
  return "";
}
