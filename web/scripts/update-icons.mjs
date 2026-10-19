// Generate the local search catalogue from an explicitly supplied upstream checkout.
// Preserves curated displayName/aliases for known slugs; new slugs get a placeholder name.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Usage: npm run icons -- /path/to/dashboard-icons");

const slugs = (await readdir(resolve(root, "svg")))
  .filter((s) => /^[a-z0-9][a-z0-9-]*\.svg$/.test(s))
  .map((s) => s.slice(0, -4))
  .sort();
if (!slugs.length) throw new Error("No SVG icons found.");

const target = new URL("../src/features/apps/appCatalogue.ts", import.meta.url);
const current = await readFile(target, "utf8");

const existing = new Map();
for (const match of current.matchAll(
  /\{\s*slug:\s*"([^"]+)"\s*,\s*displayName:\s*"([^"]+)"(?:\s*,\s*aliases:\s*(\[[^\]]*\]))?\s*\}/g,
)) {
  existing.set(match[1], {
    slug: match[1],
    displayName: match[2],
    aliases: match[3] ? JSON.parse(match[3].replaceAll("'", '"')) : undefined,
  });
}

function placeholderName(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const entries = slugs.map((slug) => {
  const prior = existing.get(slug);
  if (prior) return prior;
  return { slug, displayName: placeholderName(slug) };
});

function formatEntry(entry) {
  const aliases = entry.aliases?.length
    ? `, aliases: ${JSON.stringify(entry.aliases)}`
    : "";
  return `  { slug: ${JSON.stringify(entry.slug)}, displayName: ${JSON.stringify(entry.displayName)}${aliases} },`;
}

const block = `export const catalogueEntries: readonly CatalogueEntry[] = [\n${entries
  .map(formatEntry)
  .join("\n")}\n];`;

if (!/export const catalogueEntries: readonly CatalogueEntry\[\] = \[[\s\S]*?\];/.test(current)) {
  throw new Error("Could not locate catalogueEntries in appCatalogue.ts");
}

await writeFile(
  target,
  current.replace(
    /export const catalogueEntries: readonly CatalogueEntry\[\] = \[[\s\S]*?\];/,
    block,
  ),
);

console.log(
  `Wrote ${entries.length} catalogue entries (${existing.size} kept curated names). Review the upstream licences before distribution.`,
);
