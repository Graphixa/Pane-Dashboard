/**
 * Optional bake of a sample glass displacement map for inspection.
 * Runtime maps are generated per pane in glassDisplacementMap.ts.
 *
 *   node scripts/generate-glass-map.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const WIDTH = 160;
const HEIGHT = 160;
const RADIUS = 14 * (160 / 200);
const BEVEL = 20 * (160 / 200);

function sdRoundBox(px, py, hx, hy, r) {
  const ax = Math.abs(px) - hx + r;
  const ay = Math.abs(py) - hy + r;
  const ox = Math.max(ax, 0);
  const oy = Math.max(ay, 0);
  return Math.min(Math.max(ax, ay), 0) + Math.hypot(ox, oy) - r;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
const cx = WIDTH / 2;
const cy = HEIGHT / 2;
const hx = WIDTH / 2 - 1;
const hy = HEIGHT / 2 - 1;
const eps = 0.6;
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const px = x + 0.5 - cx;
    const py = y + 0.5 - cy;
    const d = sdRoundBox(px, py, hx, hy, RADIUS);
    let nx = 0;
    let ny = 0;
    let strength = 0;
    if (d < 0 && d > -BEVEL) {
      const dx =
        sdRoundBox(px + eps, py, hx, hy, RADIUS) -
        sdRoundBox(px - eps, py, hx, hy, RADIUS);
      const dy =
        sdRoundBox(px, py + eps, hx, hy, RADIUS) -
        sdRoundBox(px, py - eps, hx, hy, RADIUS);
      const len = Math.hypot(dx, dy) || 1;
      strength =
        smoothstep(-BEVEL, -BEVEL * 0.15, d) * smoothstep(0, -2.5, d);
      nx = -dx / len;
      ny = -dy / len;
    }
    const i = (y * WIDTH + x) * 4;
    rgba[i] = Math.round(128 + nx * strength * 127);
    rgba[i + 1] = Math.round(128 + ny * strength * 127);
    rgba[i + 2] = 128;
    rgba[i + 3] = 255;
  }
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "../dist-glass-map-sample.png",
);
writeFileSync(out, encodePng(rgba, WIDTH, HEIGHT));
console.log(`Wrote sample ${out} (runtime maps are generated per pane)`);
