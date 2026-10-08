import { parseManifest } from "./params";
import { sanitizeDynamicCss, sanitizeDynamicHtml } from "./sanitize";
import type { DynamicPack } from "./types";
import { DYNAMIC_ID_RE } from "./types";

const manifestModules = import.meta.glob<unknown>(
  "../../dynamic/*/manifest.json",
  { eager: true, import: "default" },
);
const cssModules = import.meta.glob<string>("../../dynamic/*/wallpaper.css", {
  eager: true,
  query: "?raw",
  import: "default",
});
const htmlModules = import.meta.glob<string>("../../dynamic/*/fragment.html", {
  eager: true,
  query: "?raw",
  import: "default",
});

function packIdFromPath(path: string): string | null {
  const m = path.match(/\/dynamic\/([^/]+)\//);
  return m?.[1] ?? null;
}

function loadPacks(): Map<string, DynamicPack> {
  const packs = new Map<string, DynamicPack>();
  for (const [path, raw] of Object.entries(manifestModules)) {
    const folderId = packIdFromPath(path);
    const manifest = parseManifest(raw);
    if (!folderId || !manifest || manifest.id !== folderId) continue;
    if (!DYNAMIC_ID_RE.test(manifest.id)) continue;
    const cssPath = Object.keys(cssModules).find((p) =>
      p.includes(`/dynamic/${folderId}/`),
    );
    const htmlPath = Object.keys(htmlModules).find((p) =>
      p.includes(`/dynamic/${folderId}/`),
    );
    const cssRaw = cssPath ? cssModules[cssPath] : "";
    const htmlRaw = htmlPath ? htmlModules[htmlPath] : "";
    const css = sanitizeDynamicCss(cssRaw || "", manifest.id);
    if (!css) continue;
    const fragment = sanitizeDynamicHtml(htmlRaw || "");
    packs.set(manifest.id, { ...manifest, css, fragment });
  }
  return packs;
}

const packs = loadPacks();

export function listDynamicPacks(): DynamicPack[] {
  return [...packs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getDynamicPack(id: string): DynamicPack | undefined {
  return packs.get(id);
}

export function knownDynamicIds(): string[] {
  return [...packs.keys()];
}
