import catalogueMeta from "./catalogue.meta.json";
import pngSlugList from "./catalogue.png-slugs.json";
import seedEntries from "./catalogue.seed.json";
import {
  clearCatalogueCache,
  readCatalogueCache,
  writeCatalogueCache,
} from "./catalogueCache";
import {
  mapCatalogueJson,
  mapUpstreamMetadata,
  slugToDisplayName,
  type CatalogueEntry,
  type GeneratedCatalogueEntry,
  type IconArtworkFormat,
} from "./mapUpstreamMetadata";

export type { CatalogueEntry, IconArtworkFormat } from "./mapUpstreamMetadata";
export { slugToDisplayName };

/** Build-time pin for `npm run icons` only — not used in artwork URLs. */
export const DASHBOARD_ICONS_REF: string = catalogueMeta.ref;

export const METADATA_URL =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/metadata.json";

export type IconVariant = "default" | "light" | "dark";

const releasePngSlugs = new Set(pngSlugList as string[]);
let pngSlugSet = new Set(releasePngSlugs);

/**
 * Inline popular seed. Shown immediately in Add/Edit app while the full
 * catalogue loads via `ensureCatalogue()`.
 */
export const popularCatalogueEntries: readonly CatalogueEntry[] =
  mapCatalogueJson(seedEntries as GeneratedCatalogueEntry[]);

const popularPinOrder = popularCatalogueEntries.map((entry) => entry.slug);

let cachedFull: readonly CatalogueEntry[] | null = null;
let ensurePromise: Promise<readonly CatalogueEntry[]> | null = null;
let refreshPromise: Promise<readonly CatalogueEntry[] | null> | null = null;

function applyCatalogue(entries: readonly CatalogueEntry[]): void {
  cachedFull = entries;
  pngSlugSet = new Set(
    entries.filter((entry) => entry.format === "png").map((entry) => entry.slug),
  );
  if (pngSlugSet.size === 0) pngSlugSet = new Set(releasePngSlugs);
}

/** Seed until a full catalogue has been applied this session. */
export function getActiveCatalogue(): readonly CatalogueEntry[] {
  return cachedFull ?? popularCatalogueEntries;
}

/**
 * Load the best local full catalogue without network: memory → fresh
 * localStorage → bundled release chunk.
 */
export function ensureCatalogue(): Promise<readonly CatalogueEntry[]> {
  if (cachedFull) return Promise.resolve(cachedFull);
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const cached = readCatalogueCache();
    if (cached?.fresh) {
      applyCatalogue(cached.payload.entries);
      return cachedFull!;
    }
    try {
      const mod = await import("./catalogueFull");
      if (cachedFull) return cachedFull;
      applyCatalogue(mod.fullCatalogueEntries);
      return cachedFull!;
    } catch (error) {
      ensurePromise = null;
      throw error;
    }
  })();

  return ensurePromise;
}

/**
 * If localStorage is missing or older than 24h, fetch upstream metadata.json,
 * map it, persist, and update memory. Returns null when skipped or on failure.
 */
export function refreshCatalogueIfStale(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<readonly CatalogueEntry[] | null> {
  if (refreshPromise) return refreshPromise;

  const cached = readCatalogueCache(undefined, now);
  if (cached?.fresh) {
    if (!cachedFull) applyCatalogue(cached.payload.entries);
    return Promise.resolve(null);
  }

  refreshPromise = (async () => {
    try {
      const res = await fetchImpl(METADATA_URL);
      if (!res.ok) throw new Error(`metadata fetch ${res.status}`);
      const metadata = (await res.json()) as Record<string, unknown>;
      const entries = mapUpstreamMetadata(metadata);
      if (!entries.length) throw new Error("empty metadata catalogue");
      writeCatalogueCache(entries, now);
      applyCatalogue(entries);
      return cachedFull;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Warm local baseline then refresh in the background when stale. */
export async function warmIconCatalogue(): Promise<void> {
  try {
    await ensureCatalogue();
  } catch {
    /* Seed remains available. */
  }
  void refreshCatalogueIfStale();
}

/** Test helper: drop memory and optional localStorage cache. */
export function resetCatalogueCacheForTests(clearStorage = true): void {
  cachedFull = null;
  ensurePromise = null;
  refreshPromise = null;
  pngSlugSet = new Set(releasePngSlugs);
  if (clearStorage) clearCatalogueCache();
}

export function catalogueEntry(
  slug: string,
  entries: readonly CatalogueEntry[] = getActiveCatalogue(),
): CatalogueEntry | undefined {
  return entries.find((entry) => entry.slug === slug);
}

/** Resolve the base catalogue entry for a stored `dashboard-icons:` reference. */
export function catalogueEntryForIcon(
  icon: string,
  entries: readonly CatalogueEntry[] = getActiveCatalogue(),
): CatalogueEntry | undefined {
  if (!icon.startsWith("dashboard-icons:")) return undefined;
  const slug = icon.slice("dashboard-icons:".length);
  const byBase = entries.find((entry) => entry.slug === slug);
  if (byBase) return byBase;
  return entries.find(
    (entry) =>
      entry.variants?.light === slug || entry.variants?.dark === slug,
  );
}

/** Artwork file slug for a catalogue entry under the picker variant control. */
export function resolveArtworkSlug(
  entry: Pick<CatalogueEntry, "slug" | "variants">,
  variant: IconVariant,
): string {
  if (variant === "light") return entry.variants?.light ?? entry.slug;
  if (variant === "dark") return entry.variants?.dark ?? entry.slug;
  return entry.slug;
}

/** Strip case, whitespace and common separators for separator-insensitive matching. */
export function normalizeCatalogueSearch(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-./]+/g, "");
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
  if (entry.aliases?.some((alias) => alias.toLowerCase().includes(q))) {
    return true;
  }
  const normalised = normalizeCatalogueSearch(query);
  if (!normalised) return true;
  const haystacks = [
    normalizeCatalogueSearch(entry.slug),
    normalizeCatalogueSearch(entry.displayName),
    ...(entry.aliases?.map(normalizeCatalogueSearch) ?? []),
  ];
  return haystacks.some((haystack) => haystack.includes(normalised));
}

export function filterCatalogueEntries(
  entries: readonly CatalogueEntry[],
  query: string,
): CatalogueEntry[] {
  return entries.filter((entry) => catalogueMatchesQuery(entry, query));
}

export function orderCatalogueEntries(
  entries: readonly CatalogueEntry[],
  query: string,
  pinOrder: readonly string[] = popularPinOrder,
): CatalogueEntry[] {
  const matched = filterCatalogueEntries(entries, query);
  const pinIndex = new Map(pinOrder.map((slug, index) => [slug, index]));
  return [...matched].sort((a, b) => {
    const ai = pinIndex.has(a.slug) ? pinIndex.get(a.slug)! : Number.POSITIVE_INFINITY;
    const bi = pinIndex.has(b.slug) ? pinIndex.get(b.slug)! : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    return a.slug.localeCompare(b.slug);
  });
}

export function initialRevealCount(
  matchCount: number,
  columns: number,
  rowsPerViewport: number,
): number {
  const cols = Math.max(1, columns);
  const rows = Math.max(1, rowsPerViewport) * 2;
  return Math.min(matchCount, Math.max(cols, rows * cols));
}

export function appendRevealCount(
  current: number,
  matchCount: number,
  columns: number,
  rowsPerViewport: number,
): number {
  const cols = Math.max(1, columns);
  const batch = cols * Math.max(1, rowsPerViewport);
  return Math.min(matchCount, current + batch);
}

export function applyCatalogueTileSelection<
  T extends { name: string; icon: string },
>(
  previous: T,
  entry: Pick<CatalogueEntry, "slug" | "displayName">,
  artworkSlug: string = entry.slug,
): T {
  return {
    ...previous,
    icon: `dashboard-icons:${artworkSlug}`,
    name:
      previous.name.trim() === "" ? entry.displayName : previous.name,
  };
}

export function resolveIconFormat(
  artworkSlug: string,
  entries: readonly CatalogueEntry[] = getActiveCatalogue(),
): IconArtworkFormat {
  const entry = catalogueEntryForIcon(
    `dashboard-icons:${artworkSlug}`,
    entries,
  );
  if (entry?.format === "png" || entry?.format === "svg") return entry.format;
  const base = artworkSlug.replace(/-(light|dark)$/, "");
  if (pngSlugSet.has(artworkSlug) || pngSlugSet.has(base)) return "png";
  return "svg";
}

export function alternateIconFormat(
  format: IconArtworkFormat,
): IconArtworkFormat {
  return format === "png" ? "svg" : "png";
}

/** Unpinned jsDelivr artwork URL for a known format. */
export function iconURLForFormat(
  slug: string,
  format: IconArtworkFormat,
): string {
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/${format}/${slug}.${format}`;
}

export const iconURL = (icon: string) => {
  if (!icon.startsWith("dashboard-icons:")) return icon;
  const slug = icon.slice("dashboard-icons:".length);
  return iconURLForFormat(slug, resolveIconFormat(slug));
};

export function suggestIcon(name: string, image = "") {
  const entries = getActiveCatalogue();
  const slugs = new Set(entries.map((entry) => entry.slug));
  for (const s of [name, image.split("/").at(-1)?.split(":")[0] || ""]) {
    const slug = s.toLowerCase().replaceAll("_", "-");
    if (slugs.has(slug)) return `dashboard-icons:${slug}`;
    const normalised = normalizeCatalogueSearch(slug);
    if (!normalised) continue;
    const hit = entries.find(
      (entry) => normalizeCatalogueSearch(entry.slug) === normalised,
    );
    if (hit) return `dashboard-icons:${hit.slug}`;
  }
  return "";
}
