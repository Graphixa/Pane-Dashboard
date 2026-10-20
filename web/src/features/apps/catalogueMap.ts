export type GeneratedCatalogueEntry = {
  slug: string;
  displayName: string;
  aliases?: string[];
  variants?: { light?: string; dark?: string };
};

export type MappedCatalogueEntry = {
  slug: string;
  displayName: string;
  aliases?: readonly string[];
  variants?: {
    light?: string;
    dark?: string;
  };
};

/** Map generated JSON rows into catalogue entries used by the picker. */
export function mapCatalogueJson(
  raw: readonly GeneratedCatalogueEntry[],
): MappedCatalogueEntry[] {
  return raw.map((entry) => ({
    slug: entry.slug,
    displayName: entry.displayName,
    ...(entry.aliases?.length ? { aliases: entry.aliases } : {}),
    ...(entry.variants?.light || entry.variants?.dark
      ? {
          variants: {
            ...(entry.variants.light ? { light: entry.variants.light } : {}),
            ...(entry.variants.dark ? { dark: entry.variants.dark } : {}),
          },
        }
      : {}),
  }));
}
