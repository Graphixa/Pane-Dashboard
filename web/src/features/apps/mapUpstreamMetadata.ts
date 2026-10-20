export type IconArtworkFormat = "svg" | "png";

export type CatalogueEntry = {
  slug: string;
  displayName: string;
  format: IconArtworkFormat;
  aliases?: readonly string[];
  variants?: {
    light?: string;
    dark?: string;
  };
};

/** Compact JSON rows from catalogue.generated.json / catalogue.seed.json. */
export type GeneratedCatalogueEntry = {
  slug: string;
  displayName: string;
  format?: IconArtworkFormat;
  aliases?: string[];
  variants?: { light?: string; dark?: string };
};

export function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isVariantSlug(slug: string): boolean {
  return slug.endsWith("-light") || slug.endsWith("-dark");
}

/** Map release/cache JSON rows into catalogue entries. */
export function mapCatalogueJson(
  raw: readonly GeneratedCatalogueEntry[],
): CatalogueEntry[] {
  return raw.map((entry) => ({
    slug: entry.slug,
    displayName: entry.displayName,
    format: entry.format === "png" ? "png" : "svg",
    ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
    ...(entry.variants ? { variants: entry.variants } : {}),
  }));
}

/**
 * Map upstream dashboard-icons metadata.json into catalogue entries.
 * Shared by runtime refresh and `npm run icons`.
 */
export function mapUpstreamMetadata(
  metadata: Record<string, unknown>,
): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  for (const [slug, raw] of Object.entries(metadata)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || isVariantSlug(slug)) continue;
    if (!raw || typeof raw !== "object") continue;
    const data = raw as Record<string, unknown>;
    const aliases = Array.isArray(data.aliases)
      ? data.aliases.filter(
          (alias): alias is string =>
            typeof alias === "string" && Boolean(alias.trim()),
        )
      : [];
    const colors =
      data.colors && typeof data.colors === "object"
        ? (data.colors as Record<string, unknown>)
        : null;
    const light =
      typeof colors?.light === "string" && colors.light
        ? colors.light
        : undefined;
    const dark =
      typeof colors?.dark === "string" && colors.dark ? colors.dark : undefined;
    const entry: CatalogueEntry = {
      slug,
      displayName: slugToDisplayName(slug),
      format: data.base === "png" ? "png" : "svg",
    };
    if (aliases.length) entry.aliases = aliases;
    if (light || dark) {
      entry.variants = {
        ...(light ? { light } : {}),
        ...(dark ? { dark } : {}),
      };
    }
    entries.push(entry);
  }
  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  return entries;
}
