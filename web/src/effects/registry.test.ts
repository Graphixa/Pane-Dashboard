import { describe, expect, it } from "vitest";
import { effectPacks } from "./registry";

describe("effect pack CSS scoping", () => {
  it("prefixes keyframe names without rewriting var()/calc() tokens", () => {
    const css = effectPacks.snow.css;
    expect(css).toContain('@scope (.scene-effect[data-effect-id="snow"])');
    expect(css).toContain("@keyframes pane-fx-snow-snow-fall");
    expect(css).toContain("animation: pane-fx-snow-snow-fall var(--dur, 12s)");
    expect(css).not.toMatch(/pane-fx-snow-var\(/);
    expect(css).not.toMatch(/--pane-fx-snow-dur/);
  });

  it("scopes multi-name firefly animations safely", () => {
    const css = effectPacks.fireflies.css;
    expect(css).toContain("pane-fx-fireflies-fly-drift");
    expect(css).toContain("pane-fx-fireflies-fly-pulse");
    expect(css).toContain("var(--pane-speed, 12s)");
    expect(css).not.toMatch(/pane-fx-fireflies-var\(/);
  });
});
