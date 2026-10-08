// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeDynamicCss, sanitizeDynamicHtml } from "./sanitize";

describe("sanitizeDynamicHtml", () => {
  it("keeps allowlisted markup and custom-property styles", () => {
    const html = sanitizeDynamicHtml(
      `<div class="field"><span class="p" style="--delay:-1s;--x:10%"></span></div>`,
    );
    expect(html).toContain('class="field"');
    expect(html).toContain("--delay:-1s");
  });

  it("strips scripts and handlers", () => {
    expect(sanitizeDynamicHtml(`<div onclick="alert(1)">x</div><script>bad()</script>`)).toBe(
      "",
    );
  });
});

describe("sanitizeDynamicCss", () => {
  it("scopes pack CSS and rejects remote imports", () => {
    const css = sanitizeDynamicCss(
      `:root { --x: 1; } .orb { color: red; animation: pulse 2s infinite; } @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }`,
      "bokeh",
    );
    expect(css).toContain('@scope (.scene-dynamic[data-dynamic-id="bokeh"])');
    expect(css).toContain(".pane-art::after");
    expect(css).toContain("mix-blend-mode:multiply");
    expect(css).toContain(".orb");
    expect(css).toContain("@keyframes pane-bokeh-pulse");
    expect(css).toContain("animation: pane-bokeh-pulse");
    expect(sanitizeDynamicCss(`@import url("https://evil.test/x.css");`, "x")).toBe(
      "",
    );
  });
});

