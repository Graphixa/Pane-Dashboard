/**
 * Build-time wallpaper catalogue from repository wallpapers/ folders.
 * Flat categories only; nested folders are rejected.
 * Videos/images get tiny WebP thumbs (ffmpeg) for chooser stills — not hand-authored.
 *
 * Outputs:
 * - ../../internal/builtin/data/catalogue.json + media files (Go embed)
 * - ../public/media/builtin/* (Vite static / offline browse)
 * - ../src/generated/wallpaperCatalogue.ts (UI import)
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const sourceRoot = path.join(repoRoot, "wallpapers");
const packRoot = path.join(repoRoot, "internal", "builtin", "data");
const publicRoot = path.join(webRoot, "public", "media", "builtin");
const tsOut = path.join(webRoot, "src", "generated", "wallpaperCatalogue.ts");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXT = new Set([".webm", ".mp4", ".m4v"]);
const SKIP_NAMES = new Set(["category.json", "cover.png", "cover.jpg", "cover.jpeg", "cover.webp"]);
const THUMB_WIDTH = 480;

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

/** Tiny WebP still for chooser tiles/covers. */
async function makeThumbWebp(absInput, kind, tmpDir) {
  const out = path.join(tmpDir, `${createHash("sha1").update(absInput).digest("hex")}.webp`);
  const args = ["-y"];
  if (kind === "video") args.push("-ss", "0.5");
  args.push("-i", absInput);
  if (kind === "video") args.push("-frames:v", "1");
  args.push(
    "-vf",
    `scale=${THUMB_WIDTH}:-2`,
    "-c:v",
    "libwebp",
    "-quality",
    "78",
    out,
  );
  try {
    await execFileAsync("ffmpeg", args, { windowsHide: true });
  } catch (err) {
    throw new Error(
      `ffmpeg thumb failed for ${absInput} (is ffmpeg on PATH?): ${err?.message || err}`,
    );
  }
  return readFile(out);
}

async function main() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "pane-wallpaper-thumbs-"));

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

  try {
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
        if (lower.includes(".poster.") || lower.includes(".thumb.")) continue;
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

        const thumbId = `${baseId(name)}-thumb@v${version}`;
        assertValidBuiltinId(thumbId);
        if (itemsById.has(thumbId)) throw new Error(`Duplicate thumb id: ${thumbId}`);
        const tbuf = await makeThumbWebp(abs, kind, tmpDir);
        itemsById.set(thumbId, {
          id: thumbId,
          kind: "image",
          mime: "image/webp",
          file: `media/${thumbId}`,
          bytes: tbuf.length,
          width: 0,
          height: 0,
          title: `${humanise(baseId(name))} thumb`,
          hash: createHash("sha256").update(tbuf).digest("hex"),
          categoryId: folder,
          selectable: false,
        });
        mediaWrites.push({ id: thumbId, buf: tbuf });

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
          thumbId,
          licence: typeof meta.licence === "string" ? meta.licence : undefined,
        };
        itemsById.set(id, entry);
        items.push(entry);
        mediaWrites.push({ id, buf });
      }

      if (!items.length) continue;

      let coverId =
        typeof meta.cover === "string" && itemsById.has(meta.cover)
          ? meta.cover
          : items[0].id;
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
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  categories.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const catalogue = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories,
    items: [...itemsById.values()],
  };

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
      thumbId: item.thumbId,
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
      `  thumbId?: string;\n` +
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
      `export function builtinThumbUrl(item: WallpaperCatalogueItem): string {\n` +
      `  if (item.thumbId) return builtinMediaUrl(item.thumbId);\n` +
      `  return builtinMediaUrl(item.id);\n` +
      `}\n`,
  );

  const thumbs = mediaWrites.filter((m) => m.id.includes("-thumb@")).length;
  console.log(
    `Wallpaper catalogue: ${categories.length} categories, ${Object.keys(uiItems).length} items, ${thumbs} thumbs → internal/builtin/data + public + ${path.relative(webRoot, tsOut)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
