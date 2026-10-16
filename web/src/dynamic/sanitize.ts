const MAX_HTML_BYTES = 64 * 1024;
const MAX_CSS_BYTES = 128 * 1024;
const MAX_NODES = 200;
const MAX_DEPTH = 32;

const ALLOWED_TAGS = new Set([
  "div",
  "span",
  "i",
  "b",
  "svg",
  "path",
  "g",
  "circle",
  "rect",
  "defs",
  "lineargradient",
  "stop",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "id",
  "aria-hidden",
  "viewbox",
  "preserveaspectratio",
  "d",
  "fill",
  "stroke",
  "strokewidth",
  "stroke-width",
  "cx",
  "cy",
  "r",
  "x",
  "y",
  "width",
  "height",
  "opacity",
  "transform",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientunits",
  "x1",
  "y1",
  "x2",
  "y2",
]);

const FORBIDDEN_CSS =
  /@import\b|url\s*\(\s*['"]?\s*https?:|expression\s*\(|-moz-binding\b|behavior\s*:|javascript\s*:/i;

/** Strip disallowed markup; return empty string if the fragment is unsafe or oversized. */
export function sanitizeDynamicHtml(raw: string): string {
  if (typeof raw !== "string" || raw.length > MAX_HTML_BYTES) return "";
  if (/<script|<iframe|<object|<embed|<link|<style|<foreignobject/i.test(raw))
    return "";
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(
    `<div id="pane-dyn-root">${raw}</div>`,
    "text/html",
  );
  const root = doc.getElementById("pane-dyn-root");
  if (!root) return "";
  let nodes = 0;
  const walk = (el: Element, depth: number): boolean => {
    if (depth > MAX_DEPTH) return false;
    for (const child of [...el.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text.trim()) child.textContent = text.replace(/[<>]/g, "");
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }
      nodes += 1;
      if (nodes > MAX_NODES) return false;
      const node = child as Element;
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        node.remove();
        continue;
      }
      for (const attr of [...node.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || name === "href" || name === "src") {
          node.removeAttribute(attr.name);
          continue;
        }
        // Only CSS custom properties in style= (pack particle offsets).
        if (name === "style") {
          const v = attr.value.trim();
          if (!/^--[a-z0-9-]+:[^;]+(;\s*--[a-z0-9-]+:[^;]+)*;?\s*$/i.test(v)) {
            node.removeAttribute(attr.name);
          }
          continue;
        }
        if (!ALLOWED_ATTRS.has(name) && !name.startsWith("data-")) {
          node.removeAttribute(attr.name);
        }
      }
      if (!walk(node, depth + 1)) return false;
    }
    return true;
  };
  if (!walk(root, 0)) return "";
  return root.innerHTML;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reject dangerous CSS; scope under the pack host so packs cannot clash. */
export function sanitizeDynamicCss(raw: string, packId: string): string {
  if (typeof raw !== "string" || raw.length > MAX_CSS_BYTES) return "";
  if (FORBIDDEN_CSS.test(raw)) return "";
  const scope = `.scene-dynamic[data-dynamic-id="${packId}"]`;
  // Drop html/body/:root — packs paint inside the scene host only.
  let css = raw
    .replace(/\bhtml\b\s*,\s*\bbody\b/gi, ":scope")
    .replace(/\bbody\b\s*,\s*\bhtml\b/gi, ":scope")
    .replace(/\b:root\b/gi, ":scope")
    .replace(/\bhtml\b/gi, ":scope")
    .replace(/\bbody\b/gi, ":scope");
  // Unique keyframe names so packs with shared animation labels do not collide.
  const keyframes = [
    ...css.matchAll(/@keyframes\s+([a-zA-Z_][\w-]*)/g),
  ].map((m) => m[1]);
  for (const name of new Set(keyframes)) {
    const scoped = `pane-${packId}-${name}`;
    css = css.replace(
      new RegExp(`@keyframes\\s+${escapeRegExp(name)}\\b`, "g"),
      `@keyframes ${scoped}`,
    );
    css = css.replace(
      new RegExp(`(?<=animation(?:-name)?\\s*:\\s*(?:[^;]*?)?)${escapeRegExp(name)}\\b`, "g"),
      scoped,
    );
  }
  // White/grey artwork in .pane-art is multiplied by --pane-seed; keep the sky outside that box.
  // No isolation — multiply must sample the dark field behind sparse particles.
  const tint = [
    `.pane-art{position:absolute;inset:0;}`,
    `.pane-art::after{content:"";position:absolute;inset:0;background:var(--pane-seed,#ffffff);mix-blend-mode:multiply;pointer-events:none;z-index:2;}`,
  ].join("");
  return [
    `${scope}{position:absolute;inset:0;overflow:hidden;pointer-events:none;}`,
    `@scope (${scope}){${tint}${css}}`,
    `${scope}.motion-paused,${scope}.motion-paused *{animation-play-state:paused!important;}`,
    `@media (prefers-reduced-motion:reduce){${scope},${scope} *{animation:none!important;}}`,
  ].join("\n");
}
