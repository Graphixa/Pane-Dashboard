import type { CatalogueEntry } from "./mapUpstreamMetadata";

export const CATALOGUE_CACHE_KEY = "pane-icon-catalogue-v1";
export const CATALOGUE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CATALOGUE_CACHE_VERSION = 1;

export type CatalogueCachePayload = {
  version: number;
  fetchedAt: number;
  entries: CatalogueEntry[];
};

export function readCatalogueCache(
  storage: Storage | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
  now = Date.now(),
): { payload: CatalogueCachePayload; fresh: boolean } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CATALOGUE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogueCachePayload;
    if (
      parsed?.version !== CATALOGUE_CACHE_VERSION ||
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.entries) ||
      parsed.entries.length === 0
    ) {
      return null;
    }
    return {
      payload: parsed,
      fresh: now - parsed.fetchedAt < CATALOGUE_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

export function writeCatalogueCache(
  entries: readonly CatalogueEntry[],
  fetchedAt = Date.now(),
  storage: Storage | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
): void {
  if (!storage) return;
  const payload: CatalogueCachePayload = {
    version: CATALOGUE_CACHE_VERSION,
    fetchedAt,
    entries: [...entries],
  };
  try {
    storage.setItem(CATALOGUE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* Quota or private mode — ignore. */
  }
}

export function clearCatalogueCache(
  storage: Storage | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
): void {
  storage?.removeItem(CATALOGUE_CACHE_KEY);
}
