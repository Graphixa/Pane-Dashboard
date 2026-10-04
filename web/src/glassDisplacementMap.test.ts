// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fillGlassDisplacementRgba } from "./glassDisplacementMap";

describe("fillGlassDisplacementRgba", () => {
  it("keeps the centre near neutral and encodes Y on B", () => {
    const w = 64;
    const h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    fillGlassDisplacementRgba(rgba, w, h);
    const centre = ((h / 2) * w + w / 2) * 4;
    expect(rgba[centre]).toBeGreaterThan(120);
    expect(rgba[centre]).toBeLessThan(136);
    expect(rgba[centre + 1]).toBeGreaterThan(120);
    expect(rgba[centre + 1]).toBeLessThan(136);
    expect(rgba[centre + 2]).toBe(rgba[centre + 1]);
  });

  it("bends the rim and keeps tall/wide centres cool", () => {
    const stats = (w: number, h: number) => {
      const rgba = new Uint8ClampedArray(w * h * 4);
      fillGlassDisplacementRgba(rgba, w, h);
      let rim = 0;
      let centreHot = 0;
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const hot =
            Math.abs(rgba[o] - 128) > 10 || Math.abs(rgba[o + 1] - 128) > 10;
          if (hot) rim++;
          if (
            hot &&
            Math.abs(x - cx) < w * 0.12 &&
            Math.abs(y - cy) < h * 0.12
          )
            centreHot++;
        }
      }
      let maxDev = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        maxDev = Math.max(
          maxDev,
          Math.abs(rgba[i] - 128),
          Math.abs(rgba[i + 1] - 128),
        );
      }
      return { rim, centreHot, maxDev };
    };
    const square = stats(64, 64);
    const tall = stats(32, 128);
    const wide = stats(128, 32);
    expect(square.rim).toBeGreaterThan(40);
    expect(square.maxDev).toBeGreaterThan(20);
    expect(tall.rim).toBeGreaterThan(40);
    expect(wide.rim).toBeGreaterThan(40);
    expect(tall.centreHot).toBe(0);
    expect(wide.centreHot).toBe(0);
  });
});

