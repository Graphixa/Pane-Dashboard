# Dynamic background packs

Pane ships animated wallpapers as **packs** under `web/dynamic/<id>/`. Packs are CSS-first, may include a thin static HTML fragment, and never include JavaScript or SCSS at runtime.

## Layout

```
web/dynamic/dust/
  manifest.json      # id, name, controls
  wallpaper.css      # all motion (reads --pane-* variables)
  fragment.html      # optional static markup (no <html>, no <script>)
```

`id` in the manifest must match the folder name (`^[a-z][a-z0-9-]{0,63}$`).

## Controls

Controls are declared in the manifest. Pane renders Settings UI from the schema and writes values onto CSS variables on the scene host.

| type | Value | Notes |
| --- | --- | --- |
| `range` | integer min–max | Optional `"map": "duration"` maps 0–100 → animation seconds (use plain ranges for angle, glow, size, etc.) |
| `colour` | `#rrggbb` | Hex only |
| `toggle` | boolean | Written as `1` / `0` |
| `select` | string | Must list `options: [{ value, label }]` |

Pack CSS is injected under `@scope (.scene-dynamic[data-dynamic-id="…"])` with unique `@keyframes` names so packs cannot clash.

Every control needs `key`, `label`, `type`, `default`, and `cssVar` matching `^--pane-[a-z0-9-]+$`.

## CSS rules

- Prefer selectors under the pack root (Pane scopes CSS to `.scene-dynamic[data-dynamic-id="…"]`).
- Do not use `@import`, remote `url(http…)`, or scripts.
- Honour `prefers-reduced-motion: reduce` (Pane also pauses via `.motion-paused`).
- Paint inside the scene; do not target `.shell`, settings, or panes.

## HTML rules

Allowed tags: `div`, `span`, `i`, `b`, and decorative SVG (`svg`, `path`, `g`, `circle`, `rect`, `defs`, `linearGradient`, `stop`).

Allowed extras: `class`, `id`, `aria-hidden`, SVG geometry attrs, and `style` **only** for CSS custom properties (e.g. `--delay:-2s;--x:10%`).

Caps: 64 KiB HTML, 200 nodes, depth 32. No event handlers, iframes, or external resources.

## Config

```json
{
  "kind": "dynamic",
  "dynamicId": "dust",
  "dynamicParams": { "speed": 35, "seed": "#ff00a6" }
}
```

Legacy `kind: "waves"` / `"aurora"` migrate to `dynamic` with the same ids.

## Community packs

Not in this phase. Future import will use the same manifest + sanitiser. Do not paste arbitrary CSS into Settings today.
