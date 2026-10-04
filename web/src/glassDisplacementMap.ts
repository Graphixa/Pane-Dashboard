/**
 * Pane lip displacement map (shader-parity with liquid-glass-react MIT).
 * Algorithm adapted from rdev/liquid-glass-react `ShaderDisplacementGenerator`
 * + `fragmentShaders.liquidGlass` (MIT).
 *
 * Map layout: R = X shift, G = Y shift, B = Y shift (SVG yChannelSelector="B"),
 * A = 255 (opaque so Chromium does not premultiply).
 */

const mapCache = new Map<string, string>();
/** Keep maps small — UV lip scales with slice; large bakes stall the main thread. */
const MAX_SIDE = 160;
const QUANT = 8;

function smoothStep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function roundedRectSdf(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): number {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    radius
  );
}

/** UV-space centre-magnifying lip (liquid-glass-react shader fragment). */
function liquidGlassUv(uvX: number, uvY: number): { x: number; y: number } {
  const ix = uvX - 0.5;
  const iy = uvY - 0.5;
  const distanceToEdge = roundedRectSdf(ix, iy, 0.3, 0.2, 0.6);
  const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
  const scaled = smoothStep(0, 1, displacement);
  return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 };
}

/**
 * Fill an RGBA buffer with a shader-parity displacement map.
 * Neutral centre is ~128; rim encodes centre-magnifying offsets.
 */
export function fillGlassDisplacementRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): void {
  // Peak pull is toward UV centre → bounded by half the long side.
  const maxScale = Math.max(width, height, 2) * 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = liquidGlassUv((x + 0.5) / width, (y + 0.5) / height);
      const dx = pos.x * width - (x + 0.5);
      const dy = pos.y * height - (y + 0.5);
      const edgeDistance = Math.min(x, y, width - x - 1, height - y - 1);
      const edgeFactor = Math.min(1, edgeDistance / 2);
      const r = (dx * edgeFactor) / maxScale + 0.5;
      const g = (dy * edgeFactor) / maxScale + 0.5;
      const o = (y * width + x) * 4;
      rgba[o] = Math.max(0, Math.min(255, (r * 255 + 0.5) | 0));
      rgba[o + 1] = Math.max(0, Math.min(255, (g * 255 + 0.5) | 0));
      rgba[o + 2] = rgba[o + 1];
      rgba[o + 3] = 255;
    }
  }
}

function quantize(n: number): number {
  return Math.max(QUANT, Math.round(n / QUANT) * QUANT);
}

/** Build a displacement map sized to a pane (UV lip, capped + quantised). */
export function buildGlassDisplacementMap(
  cssWidth: number,
  cssHeight: number,
): string | null {
  if (
    typeof document === "undefined" ||
    !Number.isFinite(cssWidth) ||
    !Number.isFinite(cssHeight) ||
    cssWidth < 2 ||
    cssHeight < 2
  ) {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(cssWidth, cssHeight));
  const width = quantize(Math.max(QUANT, cssWidth * scale));
  const height = quantize(Math.max(QUANT, cssHeight * scale));
  const key = `${width}x${height}shader-v2`;
  const cached = mapCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.createImageData(width, height);
  fillGlassDisplacementRgba(image.data, width, height);
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  mapCache.set(key, url);
  return url;
}
