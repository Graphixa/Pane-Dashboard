import catalogueMeta from "./catalogue.meta.json";
import seedEntries from "./catalogue.seed.json";
import {
  mapCatalogueJson,
  type GeneratedCatalogueEntry,
  type MappedCatalogueEntry,
} from "./catalogueMap";
import { popularSlugs } from "./popularSlugs";

/** Pinned homarr-labs/dashboard-icons git ref used for CDN artwork URLs. */
export const DASHBOARD_ICONS_REF: string = catalogueMeta.ref;

export type IconVariant = "default" | "light" | "dark";

/** Dashboard Icons entry with a stable slug and UI display name. */
export type CatalogueEntry = MappedCatalogueEntry;

/**
 * Inline popular seed (~80 entries). Shown immediately in Add/Edit app while the
 * full catalogue chunk loads via `ensureFullCatalogue()`.
 */
export const popularCatalogueEntries: readonly CatalogueEntry[] =
  mapCatalogueJson(seedEntries as GeneratedCatalogueEntry[]);

/** @deprecated Prefer getActiveCatalogue() — kept as the sync seed for callers. */
export const catalogueEntries: readonly CatalogueEntry[] =
  popularCatalogueEntries;

/** Derived slug list from the active catalogue (seed until full load completes). */
export function getCatalogueSlugs(
  entries: readonly CatalogueEntry[] = getActiveCatalogue(),
): readonly string[] {
  return entries.map((entry) => entry.slug);
}

/** @deprecated Prefer getCatalogueSlugs() after ensureFullCatalogue(). */
export const catalogue: readonly string[] = popularCatalogueEntries.map(
  (entry) => entry.slug,
);

let cachedFull: readonly CatalogueEntry[] | null = null;
let loadPromise: Promise<readonly CatalogueEntry[]> | null = null;

/** Seed until the full index has been loaded at least once this session. */
export function getActiveCatalogue(): readonly CatalogueEntry[] {
  return cachedFull ?? popularCatalogueEntries;
}

/** Whether the full catalogue chunk has been applied. */
export function isFullCatalogueReady(): boolean {
  return cachedFull !== null;
}

/**
 * Dynamically import the full catalogue JSON chunk. Safe to call repeatedly;
 * resolves to the same cached list after the first success.
 */
export function ensureFullCatalogue(): Promise<readonly CatalogueEntry[]> {
  if (cachedFull) return Promise.resolve(cachedFull);
  if (!loadPromise) {
    loadPromise = import("./catalogueFull")
      .then((mod) => {
        cachedFull = mod.fullCatalogueEntries;
        return cachedFull;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

/** Test helper: drop the lazy-load cache. */
export function resetCatalogueCacheForTests(): void {
  cachedFull = null;
  loadPromise = null;
}

/** Title-case a kebab slug for display / blank Name autofill. */
export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

/**
 * Match displayName, slug and aliases case-insensitively, including normalised
 * forms so “AdGuard Home”, “adguard-home” and “adguardhome” hit the same entry.
 */
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

/** Filter the full catalogue in input order; callers then order and limit rows. */
export function filterCatalogueEntries(
  entries: readonly CatalogueEntry[],
  query: string,
): CatalogueEntry[] {
  return entries.filter((entry) => catalogueMatchesQuery(entry, query));
}

/**
 * Filter then order: popular pin list first (stable order), then remaining
 * matches alphabetically by slug. Applies for empty and non-empty queries.
 */
export function orderCatalogueEntries(
  entries: readonly CatalogueEntry[],
  query: string,
  pinOrder: readonly string[] = popularSlugs,
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

/** Rows to cover the scrollport plus approximately one viewport ahead. */
export function initialRevealCount(
  matchCount: number,
  columns: number,
  rowsPerViewport: number,
): number {
  const cols = Math.max(1, columns);
  const rows = Math.max(1, rowsPerViewport) * 2;
  return Math.min(matchCount, Math.max(cols, rows * cols));
}

/** Append approximately one viewport of complete rows. */
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

/**
 * Apply a catalogue tile selection: always set the icon; fill Name only when blank
 * (empty or whitespace-only). Preserve every other field byte-for-byte.
 */
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

export const iconURL = (icon: string) =>
  icon.startsWith("dashboard-icons:")
    ? `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${DASHBOARD_ICONS_REF}/svg/${icon.slice(16)}.svg`
    : icon;

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
