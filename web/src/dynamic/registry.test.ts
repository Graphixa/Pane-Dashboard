// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  cssValueForControl,
  defaultDynamicParams,
  validateDynamicParams,
} from "./params";
import { getDynamicPack, knownDynamicIds, listDynamicPacks } from "./registry";

const expected = [
  "aurora",
  "bokeh",
  "diagonals",
  "dust",
  "fireflies",
  "flow",
  "matrix",
  "snow",
  "stars",
  "waves",
];

describe("dynamic pack registry", () => {
  it("loads every bundled pack", () => {
    expect(knownDynamicIds().sort()).toEqual(expected);
    expect(listDynamicPacks()).toHaveLength(expected.length);
    for (const id of expected) {
      const pack = getDynamicPack(id);
      expect(pack, id).toBeDefined();
      expect(pack!.css).toContain(`data-dynamic-id="${id}"`);
      expect(pack!.controls.length).toBeGreaterThan(0);
    }
  });

  it("validates pack params against the manifest", () => {
    const pack = getDynamicPack("dust")!;
    const defaults = defaultDynamicParams(pack);
    expect(defaults.seed).toBe("#ff00a6");
    expect(validateDynamicParams(pack, { seed: "#112233", speed: 10 }).seed).toBe(
      "#112233",
    );
    expect(validateDynamicParams(pack, { seed: "red" }).seed).toBe(defaults.seed);
    expect(validateDynamicParams(pack, { speed: 999 }).speed).toBe(defaults.speed);
    const speed = pack.controls.find((c) => c.key === "speed")!;
    const duration = parseFloat(cssValueForControl(speed, 40));
    expect(duration).toBeGreaterThanOrEqual(3);
    expect(duration).toBeLessThanOrEqual(20);
  });
});



