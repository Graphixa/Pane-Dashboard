import { describe, expect, it } from "vitest";
import { resolveGlassRefract } from "./useGlassQuality";

describe("resolveGlassRefract", () => {
  const base = {
    glassMode: true,
    capable: true,
    reducedMotion: false,
    interacting: false,
    visibleCount: 3,
  };
  it("uses full refraction when idle and capable with few visible panes", () => {
    expect(resolveGlassRefract(base)).toBe("full");
  });
  it("drops to lite when many panes are refracting", () => {
    expect(resolveGlassRefract({ ...base, visibleCount: 7 })).toBe("full");
    expect(resolveGlassRefract({ ...base, visibleCount: 15 })).toBe("lite");
  });
  it("turns refraction off while dragging or resizing", () => {
    expect(resolveGlassRefract({ ...base, interacting: true })).toBe("off");
  });
  it("turns refraction off for reduced motion or incapable browsers", () => {
    expect(resolveGlassRefract({ ...base, reducedMotion: true })).toBe("off");
    expect(resolveGlassRefract({ ...base, capable: false })).toBe("off");
  });
  it("stays off for solid finish", () => {
    expect(resolveGlassRefract({ ...base, glassMode: false })).toBe("off");
  });
});
