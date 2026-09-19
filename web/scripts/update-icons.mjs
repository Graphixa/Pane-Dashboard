// Generate the local search catalogue from an explicitly supplied upstream checkout.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.argv[2];
if (!root) throw new Error("Usage: npm run icons -- /path/to/dashboard-icons");
const slugs = (await readdir(resolve(root, "svg")))
  .filter((s) => /^[a-z0-9][a-z0-9-]*\.svg$/.test(s))
  .map((s) => s.slice(0, -4))
  .sort();
if (!slugs.length) throw new Error("No SVG icons found.");
const target = new URL("../src/icons.ts", import.meta.url);
const current = await readFile(target, "utf8");
await writeFile(
  target,
  current.replace(
    /export const catalogue = \[[\s\S]*?\];/,
    `export const catalogue = ${JSON.stringify(slugs, null, 2)};`,
  ),
);
console.log(
  `Wrote ${slugs.length} icon slugs. Review the upstream licences before distribution.`,
);
