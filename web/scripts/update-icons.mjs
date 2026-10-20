// Generate the bundled Dashboard Icons catalogue from upstream metadata.json.
// Usage:
//   npm run icons                  # fetch metadata for the pin in catalogue.meta.json
//   npm run icons -- /path/to/repo # read metadata.json from a local checkout
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const metaPath = new URL(
  "../src/features/apps/catalogue.meta.json",
  import.meta.url,
);
const outPath = new URL(
  "../src/features/apps/catalogue.generated.json",
  import.meta.url,
);
const seedPath = new URL(
  "../src/features/apps/catalogue.seed.json",
  import.meta.url,
);
const pngPath = new URL(
  "../src/features/apps/catalogue.png-slugs.json",
  import.meta.url,
);
const popularPath = new URL(
  "../src/features/apps/popularSlugs.ts",
  import.meta.url,
);

/** @param {string} slug */
function slugToDisplayName(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isVariantSlug(slug) {
  return slug.endsWith("-light") || slug.endsWith("-dark");
}

/**
 * @param {Record<string, unknown>} metadata
 * @returns {object[]}
 */
function entriesFromMetadata(metadata) {
  const entries = [];
  for (const [slug, raw] of Object.entries(metadata)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || isVariantSlug(slug)) continue;
    if (!raw || typeof raw !== "object") continue;
    const data = /** @type {Record<string, unknown>} */ (raw);
    const aliases = Array.isArray(data.aliases)
      ? data.aliases.filter((a) => typeof a === "string" && a.trim())
      : [];
    const colors =
      data.colors && typeof data.colors === "object"
        ? /** @type {Record<string, unknown>} */ (data.colors)
        : null;
    const light =
      typeof colors?.light === "string" && colors.light ? colors.light : undefined;
    const dark =
      typeof colors?.dark === "string" && colors.dark ? colors.dark : undefined;
    const base = data.base === "png" ? "png" : "svg";
    /** @type {{ slug: string, displayName: string, format: "svg"|"png", aliases?: string[], variants?: { light?: string, dark?: string } }} */
    const entry = {
      slug,
      displayName: slugToDisplayName(slug),
      format: base,
    };
    if (aliases.length) entry.aliases = aliases;
    if (light || dark) {
      entry.variants = {};
      if (light) entry.variants.light = light;
      if (dark) entry.variants.dark = dark;
    }
    entries.push(entry);
  }
  entries.sort((a, b) => a.slug.localeCompare(b.slug));
  return entries;
}

const meta = JSON.parse(await readFile(metaPath, "utf8"));
const ref = typeof meta.ref === "string" && meta.ref ? meta.ref : "";
if (!ref) throw new Error("catalogue.meta.json must include a non-empty ref pin");

const localRoot = process.argv[2];
let metadata;
if (localRoot) {
  const path = resolve(localRoot, "metadata.json");
  metadata = JSON.parse(await readFile(path, "utf8"));
} else {
  const url = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${ref}/metadata.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  metadata = await res.json();
}

const entries = entriesFromMetadata(metadata);
if (!entries.length) throw new Error("No catalogue entries generated from metadata");

const generatedAt = new Date().toISOString();
await writeFile(outPath, `${JSON.stringify(entries)}\n`);

const popularSource = await readFile(popularPath, "utf8");
const popularSlugs = [
  ...popularSource.matchAll(/^\s*"([a-z0-9][a-z0-9-]*)"/gm),
].map((match) => match[1]);
const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
const seed = popularSlugs
  .map((slug) => bySlug.get(slug))
  .filter(Boolean);
if (!seed.length) {
  throw new Error("No popular seed entries matched the generated catalogue");
}
await writeFile(seedPath, `${JSON.stringify(seed)}\n`);

const pngSlugs = entries
  .filter((entry) => entry.format === "png")
  .map((entry) => entry.slug);
await writeFile(pngPath, `${JSON.stringify(pngSlugs)}\n`);

await writeFile(
  metaPath,
  `${JSON.stringify({ ref, generatedAt }, null, 2)}\n`,
);

console.log(
  `Wrote ${entries.length} catalogue entries (${pngSlugs.length} png), ${seed.length} seed pins (pin ${ref.slice(0, 12)}…). Upstream licence: Apache-2.0.`,
);
