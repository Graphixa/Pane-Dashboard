// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fillGlassDisplacementRgba } from "./glassDisplacementMap";

describe("fillGlassDisplacementRgba", () => {
  it("keeps the centre neutral with no lip mask, and marks the rim", () => {
    const w = 64;
    const h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    fillGlassDisplacementRgba(rgba, w, h, 10, 28, 0.42);
    const centre = ((h / 2) * w + w / 2) * 4;
    expect(rgba[centre]).toBeGreaterThan(120);
    expect(rgba[centre]).toBeLessThan(136);
    expect(rgba[centre + 2]).toBeLessThan(20);
    const midLeft = ((h / 2) * w + 3) * 4;
    expect(rgba[midLeft]).toBeGreaterThan(140);
    expect(rgba[midLeft + 2]).toBeGreaterThan(100);
  });

  it("keeps lip activity on tall and wide maps", () => {
    const active = (w: number, h: number) => {
      const rgba = new Uint8ClampedArray(w * h * 4);
      fillGlassDisplacementRgba(rgba, w, h, 8, 16, 0.42);
      let n = 0;
      for (let i = 2; i < rgba.length; i += 4) {
        if (rgba[i] > 40) n++;
      }
      return n;
    };
    expect(active(32, 128)).toBeGreaterThan(40);
    expect(active(128, 32)).toBeGreaterThan(40);
  });
});

