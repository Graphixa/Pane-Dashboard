/**
 * Build-time wallpaper catalogue from repository wallpapers/ folders.
 * Flat categories only; nested folders are rejected.
 *
 * Outputs:
 * - ../../builtin/catalogue.json + media files (Go embed)
 * - ../public/media/builtin/* (Vite static / offline browse)
 * - ../src/generated/wallpaperCatalogue.ts (UI import)
 */
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const sourceRoot = path.join(repoRoot, "wallpapers");
const packRoot = path.join(repoRoot, "builtin");
const publicRoot = path.join(webRoot, "public", "media", "builtin");
const tsOut = path.join(webRoot, "src", "generated", "wallpaperCatalogue.ts");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXT = new Set([".webm", ".mp4", ".m4v"]);
const SKIP_NAMES = new Set(["category.json", "cover.png", "cover.jpg", "cover.jpeg", "cover.webp"]);

function humanise(folder) {
  return folder
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function mimeFor(ext, kind) {
  if (kind === "video") {
    if (ext === ".webm") return "video/webm";
    return "video/mp4";
  }
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function baseId(file) {
  return path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

/** PNG IHDR width/height; other formats leave 0 (runtime HEAD / renderer handles). */
function probePngSize(buf) {
  if (buf.length < 24) return { width: 0, height: 0 };
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return { width: 0, height: 0 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function assertValidBuiltinId(id) {
  if (!/^[a-z0-9][a-z0-9-]*@v\d+$/.test(id) || id.includes("..") || id.length > 128) {
    throw new Error(`Invalid builtin id: ${id}`);
  }
}

async function main() {
  let categoryDirs = [];
  try {
    const entries = await readdir(sourceRoot, { withFileTypes: true });
    categoryDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.warn("wallpapers/ missing — writing empty catalogue.");
    } else {
      throw err;
    }
  }

  const categories = [];
  const itemsById = new Map();
  const mediaWrites = [];

  for (const folder of categoryDirs) {
    const dir = path.join(sourceRoot, folder);
    const nested = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory());
    if (nested.length) {
      throw new Error(
        `Nested folders are not supported in wallpapers/${folder}/ (found ${nested[0].name}). Keep categories flat.`,
      );
    }

    let meta = {};
    try {
      meta = JSON.parse(await readFile(path.join(dir, "category.json"), "utf8"));
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
    }

    const files = (await readdir(dir))
      .filter((name) => !SKIP_NAMES.has(name.toLowerCase()))
      .filter((name) => !name.startsWith("."))
      .sort();

    const items = [];
    for (const name of files) {
      const ext = path.extname(name).toLowerCase();
      const lower = name.toLowerCase();
      if (lower.endsWith(".poster.png") || lower.endsWith(".poster.jpg") || lower.endsWith(".poster.webp")) {
        continue; // poster sidecar, not a selectable wallpaper
      }
      if (lower === "cover.png" || lower === "cover.jpg" || lower === "cover.webp") continue;

      let kind = null;
      if (IMAGE_EXT.has(ext)) kind = "image";
      else if (VIDEO_EXT.has(ext)) kind = "video";
      else {
        throw new Error(`Unsupported file wallpapers/${folder}/${name}`);
      }

      const version = Number.isInteger(meta.version) ? meta.version : 1;
      const id = `${baseId(name)}@v${version}`;
      assertValidBuiltinId(id);
      if (itemsById.has(id)) throw new Error(`Duplicate builtin id: ${id}`);

      const abs = path.join(dir, name);
      const buf = await readFile(abs);
      const hash = createHash("sha256").update(buf).digest("hex");
      const size = kind === "image" && ext === ".png" ? probePngSize(buf) : { width: 0, height: 0 };

      let posterId = undefined;
      const posterCandidates = [
        `${path.basename(name, ext)}.poster.png`,
        `${path.basename(name, ext)}.poster.jpg`,
        `${path.basename(name, ext)}.poster.webp`,
      ];
      for (const p of posterCandidates) {
        try {
          await stat(path.join(dir, p));
          posterId = `${baseId(name)}-poster@v${version}`;
          const pbuf = await readFile(path.join(dir, p));
          assertValidBuiltinId(posterId);
          if (itemsById.has(posterId)) throw new Error(`Duplicate poster id: ${posterId}`);
          itemsById.set(posterId, {
            id: posterId,
            kind: "image",
            mime: mimeFor(path.extname(p).toLowerCase(), "image"),
            file: `media/${posterId}`,
            bytes: pbuf.length,
            width: 0,
            height: 0,
            title: `${humanise(baseId(name))} poster`,
            hash: createHash("sha256").update(pbuf).digest("hex"),
            categoryId: folder,
            selectable: false,
          });
          mediaWrites.push({ id: posterId, buf: pbuf });
          break;
        } catch (e) {
          if (e && e.code !== "ENOENT") throw e;
        }
      }

      const title =
        typeof meta.titles?.[baseId(name)] === "string"
          ? meta.titles[baseId(name)]
          : humanise(baseId(name));

      const entry = {
        id,
        kind,
        mime: mimeFor(ext, kind),
        file: `media/${id}`,
        bytes: buf.length,
        width: size.width,
        height: size.height,
        title,
        hash,
        categoryId: folder,
        selectable: true,
        posterId,
        licence: typeof meta.licence === "string" ? meta.licence : undefined,
      };
      itemsById.set(id, entry);
      items.push(entry);
      mediaWrites.push({ id, buf });
    }

    if (!items.length) continue; // empty bundled categories omitted from catalogue

    let coverId =
      typeof meta.cover === "string" && itemsById.has(meta.cover)
        ? meta.cover
        : items[0].id;
    // Prefer image cover; else first item (video uses poster when browsing)
    const imageCover = items.find((i) => i.kind === "image");
    if (!meta.cover && imageCover) coverId = imageCover.id;

    categories.push({
      id: folder,
      name: typeof meta.name === "string" ? meta.name : humanise(folder),
      order: Number.isFinite(meta.order) ? meta.order : categories.length + 1,
      coverId,
      itemIds: items.map((i) => i.id),
    });
  }

  categories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const catalogue = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories,
    items: [...itemsById.values()].filter((i) => i.selectable !== false || i.id.includes("-poster@")),
  };

  // Rebuild pack + public
  await rm(packRoot, { recursive: true, force: true });
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(path.join(packRoot, "media"), { recursive: true });
  await mkdir(publicRoot, { recursive: true });

  for (const { id, buf } of mediaWrites) {
    await writeFile(path.join(packRoot, "media", id), buf);
    await writeFile(path.join(publicRoot, id), buf);
  }
  await writeFile(path.join(packRoot, "catalogue.json"), JSON.stringify(catalogue, null, 2) + "\n");
  await copyFile(path.join(packRoot, "catalogue.json"), path.join(publicRoot, "catalogue.json"));

  const uiCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    coverId: c.coverId,
    itemIds: c.itemIds,
  }));
  const uiItems = {};
  for (const item of itemsById.values()) {
    if (item.selectable === false) continue;
    uiItems[item.id] = {
      id: item.id,
      kind: item.kind,
      title: item.title,
      mime: item.mime,
      width: item.width,
      height: item.height,
      posterId: item.posterId,
      categoryId: item.categoryId,
    };
  }

  await mkdir(path.dirname(tsOut), { recursive: true });
  await writeFile(
    tsOut,
    `/* Generated by scripts/generate-wallpaper-catalogue.mjs — do not edit. */\n` +
      `export type WallpaperCatalogueItem = {\n` +
      `  id: string;\n` +
      `  kind: "image" | "video";\n` +
      `  title: string;\n` +
      `  mime: string;\n` +
      `  width: number;\n` +
      `  height: number;\n` +
      `  posterId?: string;\n` +
      `  categoryId: string;\n` +
      `};\n` +
      `export type WallpaperCatalogueCategory = {\n` +
      `  id: string;\n` +
      `  name: string;\n` +
      `  coverId: string;\n` +
      `  itemIds: string[];\n` +
      `};\n` +
      `export const wallpaperCatalogueCategories: WallpaperCatalogueCategory[] = ${JSON.stringify(uiCategories, null, 2)};\n` +
      `export const wallpaperCatalogueItems: Record<string, WallpaperCatalogueItem> = ${JSON.stringify(uiItems, null, 2)};\n` +
      `export function builtinMediaUrl(id: string): string {\n` +
      `  return "/media/builtin/" + encodeURIComponent(id);\n` +
      `}\n` +
      `export function builtinPosterUrl(item: WallpaperCatalogueItem): string {\n` +
      `  if (item.posterId) return builtinMediaUrl(item.posterId);\n` +
      `  if (item.kind === "image") return builtinMediaUrl(item.id);\n` +
      `  return builtinMediaUrl(item.id);\n` +
      `}\n`,
  );

  console.log(
    `Wallpaper catalogue: ${categories.length} categories, ${Object.keys(uiItems).length} items → builtin/ + public + ${path.relative(webRoot, tsOut)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
