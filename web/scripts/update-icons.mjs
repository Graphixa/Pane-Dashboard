// Generate the bundled Dashboard Icons catalogue from upstream metadata.json.
// Usage:
//   npm run icons                  # fetch metadata for the pin in catalogue.meta.json
//   npm run icons -- /path/to/repo # read metadata.json from a local checkout
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mapUpstreamMetadata } from "../src/features/apps/mapUpstreamMetadata.ts";
import popularSlugs from "../src/features/apps/popularSlugs.json" with { type: "json" };

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

const entries = mapUpstreamMetadata(metadata);
if (!entries.length) throw new Error("No catalogue entries generated from metadata");

await writeFile(outPath, `${JSON.stringify(entries)}\n`);

const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
const seed = popularSlugs.map((slug) => bySlug.get(slug)).filter(Boolean);
if (!seed.length) {
  throw new Error("No popular seed entries matched the generated catalogue");
}
await writeFile(seedPath, `${JSON.stringify(seed)}\n`);

await writeFile(metaPath, `${JSON.stringify({ ref }, null, 2)}\n`);

console.log(
  `Wrote ${entries.length} catalogue entries and ${seed.length} seed pins (pin ${ref.slice(0, 12)}…). Upstream licence: Apache-2.0.`,
);
