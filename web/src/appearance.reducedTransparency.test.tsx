// @vitest-environment jsdom
// @ts-nocheck — reads appearance.css via Node fs; suite is excluded from app types.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * jsdom does not honour prefers-reduced-transparency or resolve var(--panel)
 * into backgroundColor. Mirror the production cascade with concrete colours so
 * getComputedStyle asserts the winning rule, not CSS source alone.
 */
function mountGlassPane(panel: string) {
  const style = document.createElement("style");
  style.textContent = `
[data-pane-style="glass"] .pane {
  position: relative;
  overflow: hidden;
  background: transparent;
  border: 0;
  box-shadow: 0 14px 44px rgb(0 0 0 / 0.28);
}
[data-pane-style="glass"] .pane-glass-warp,
[data-pane-style="glass"] .pane-glass-tint,
[data-pane-style="glass"] .pane-glass-shine,
[data-pane-style="glass"] .pane-glass-rim {
  display: block;
}
.pane,
[data-pane-style="glass"] .pane {
  background: ${panel};
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  border-color: transparent;
  box-shadow: inset 0 0 0 1px rgb(80, 90, 100);
}
[data-pane-style="glass"] .pane-glass-warp,
[data-pane-style="glass"] .pane-glass-tint,
[data-pane-style="glass"] .pane-glass-shine,
[data-pane-style="glass"] .pane-glass-rim {
  display: none;
}
[data-pane-style="glass"] .pane-glass-warp {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  filter: none !important;
}
`;
  document.head.append(style);

  const shell = document.createElement("div");
  shell.dataset.paneStyle = "glass";

  const pane = document.createElement("div");
  pane.className = "pane";
  for (const name of [
    "pane-glass-warp",
    "pane-glass-tint",
    "pane-glass-shine",
    "pane-glass-rim",
  ]) {
    const layer = document.createElement("span");
    layer.className = name;
    pane.append(layer);
  }
  shell.append(pane);
  document.body.append(shell);
  return { pane };
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach((el) => el.remove());
});

describe("reduced-transparency glass fallback", () => {
  it("keeps the production reduce block at glass specificity", () => {
    const appearanceCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "appearance.css"),
      "utf8",
    );
    const start = appearanceCss.indexOf(
      "@media (prefers-reduced-transparency: reduce)",
    );
    expect(start).toBeGreaterThan(-1);
    const reduce = appearanceCss.slice(start, start + 900);
    expect(reduce).toMatch(
      /\.pane\s*,\s*\[data-pane-style="glass"\]\s*\.pane/,
    );
    expect(reduce).toMatch(/background:\s*var\(--panel\)/);
    expect(reduce).toContain(
      '[data-pane-style="glass"] .pane-frame.focused .pane',
    );
  });

  it("computes a solid panel background over glass transparent", () => {
    const panel = "rgb(26, 34, 46)";
    const { pane } = mountGlassPane(panel);
    const style = getComputedStyle(pane);
    expect(style.backgroundColor).toBe(panel);
    const filter =
      style.backdropFilter ||
      (style as CSSStyleDeclaration & { webkitBackdropFilter?: string })
        .webkitBackdropFilter ||
      "";
    expect(filter === "" || filter === "none").toBe(true);
    for (const name of [
      "pane-glass-warp",
      "pane-glass-tint",
      "pane-glass-shine",
      "pane-glass-rim",
    ]) {
      expect(getComputedStyle(pane.querySelector(`.${name}`)!).display).toBe(
        "none",
      );
    }
  });

  it("uses a custom palette surface under the same cascade", () => {
    const panel = "rgb(40, 20, 60)";
    const { pane } = mountGlassPane(panel);
    expect(getComputedStyle(pane).backgroundColor).toBe(panel);
  });

  it("uses Daylight panel surface under the same cascade", () => {
    const panel = "rgb(255, 255, 255)";
    const { pane } = mountGlassPane(panel);
    expect(getComputedStyle(pane).backgroundColor).toBe(panel);
  });
});
