/** Pane corner radius in CSS (`.pane`). */
export const PANE_CORNER_RADIUS = 14;
/** Screen-space width of the refractive lip, in CSS pixels. */
export const GLASS_BEVEL_PX = 28;
/** How strongly the lip pulls samples toward the centre (0–1). */
export const GLASS_REFRACT_AMOUNT = 0.42;

const mapCache = new Map<string, string>();

function sdRoundBox(
  px: number,
  py: number,
  hx: number,
  hy: number,
  r: number,
): number {
  const ax = Math.abs(px) - hx + r;
  const ay = Math.abs(py) - hy + r;
  const ox = Math.max(ax, 0);
  const oy = Math.max(ay, 0);
  return Math.min(Math.max(ax, ay), 0) + Math.hypot(ox, oy) - r;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Original Pane lip map.
 * R = X shift, G = Y shift (128 = neutral), B = lip strength for the edge mask,
 * A = 255 (keep opaque so Chromium does not premultiply the displacement).
 */
export function fillGlassDisplacementRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  radius: number,
  bevel: number,
  amount = GLASS_REFRACT_AMOUNT,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const hx = Math.max(1, width / 2 - 1);
  const hy = Math.max(1, height / 2 - 1);
  const r = Math.min(radius, hx, hy);
  const band = Math.max(3, bevel);
  const raw: number[] = [];
  let maxScale = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const d = sdRoundBox(px, py, hx, hy, r);
      let dx = 0;
      let dy = 0;
      let strength = 0;
      if (d < 0) {
        const fromEdge = -d;
        // Rounded SDF falloff only — rectangular edgeFade drew hard L-steps.
        const lip = 1 - smoothstep(0, band, fromEdge);
        const shaped = lip * lip * (3 - 2 * lip);
        // Soften the outermost SDF ring so feDisplacementMap does not tear,
        // still following the round (not axis-aligned min(x,y)).
        const rimSoft = smoothstep(0, 2, fromEdge);
        strength = shaped * rimSoft;
        const scaled = 1 - shaped * amount * rimSoft;
        dx = px * scaled - px;
        dy = py * scaled - py;
      }
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
      raw.push(dx, dy, strength);
    }
  }

  maxScale = Math.max(maxScale, 1);
  let i = 0;
  for (let p = 0; p < width * height; p++) {
    const dx = raw[i++];
    const dy = raw[i++];
    const strength = raw[i++];
    const o = p * 4;
    rgba[o] = Math.max(
      0,
      Math.min(255, Math.round((dx / maxScale) * 0.5 * 255 + 128)),
    );
    rgba[o + 1] = Math.max(
      0,
      Math.min(255, Math.round((dy / maxScale) * 0.5 * 255 + 128)),
    );
    rgba[o + 2] = Math.max(0, Math.min(255, Math.round(strength * 255)));
    rgba[o + 3] = 255;
  }
}

/** Build a displacement map sized to a pane (fixed screen-space lip). */
export function buildGlassDisplacementMap(
  cssWidth: number,
  cssHeight: number,
  options?: {
    radius?: number;
    bevel?: number;
    amount?: number;
    maxSide?: number;
  },
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
  const radius = options?.radius ?? PANE_CORNER_RADIUS;
  const bevel = options?.bevel ?? GLASS_BEVEL_PX;
  const amount = options?.amount ?? GLASS_REFRACT_AMOUNT;
  const maxSide = options?.maxSide ?? 256;
  const scale = Math.min(1, maxSide / Math.max(cssWidth, cssHeight));
  const width = Math.max(12, Math.round(cssWidth * scale));
  const height = Math.max(12, Math.round(cssHeight * scale));
  const mapRadius = Math.max(2, radius * scale);
  const mapBevel = Math.max(6, bevel * scale);
  const key = `${width}x${height}r${mapRadius.toFixed(1)}b${mapBevel.toFixed(1)}a${amount}v8`;
  const cached = mapCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.createImageData(width, height);
  fillGlassDisplacementRgba(
    image.data,
    width,
    height,
    mapRadius,
    mapBevel,
    amount,
  );
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  mapCache.set(key, url);
  return url;
}

export function clearGlassDisplacementCache(): void {
  mapCache.clear();
}
