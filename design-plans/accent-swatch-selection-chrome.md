# Accent swatch selected state uses accent ring

Written against: d2b0f19

## Evidence chain

- Surface: Settings → Appearance → Colours → accent preset circles
- Problem: Selected accent swatch draws `outline: 2px solid var(--text)`, so selection chrome is text-coloured while Theme cards and Background gallery selection use accent wash/border on the same settings surface
- Design evidence: `SPEC.md` Settings refactor — choice/gallery selection uses accent fill, accent wash, or accent border; inspiration `planning/inspiration/settings-cool.png` and `planning/inspiration/settings-general-logo-and-theme.png` show accent-ring / in-swatch check selection on brand colour chips
- Owner: `web/src/settings.css` (`.accent-swatches button[aria-pressed="true"]`, `.accent-swatch[aria-pressed="true"]`, `.accent-swatch[aria-expanded="true"]`)
- Scope and affected surfaces: Appearance → Colours accent row only (`web/src/AppearanceEditor.tsx` buttons with `className="accent-swatch"`)
- Uncertainty: none for the selection language; ring must stay readable when the selected fill equals `var(--accent)` (Mint / current accent)

## Design decision

Replace the text-coloured outline on selected accent swatches with an accent-coloured ring plus a short spacer so the ring stays visible on same-colour fills. Keep the existing interior ✓. Do not change swatch size, circular shape, preset list, or Custom palette disclosure behaviour.

## Reuse

- Selection language exemplar: `.background-swatch[aria-pressed="true"]` in `web/src/appearance.css` (`border-color: var(--accent)`; accent emphasis)
- Existing chip chrome: `.accent-swatch` already has `border: 2px solid transparent` and an interior ✓ span in `web/src/AppearanceEditor.tsx`
- Tokens: `var(--accent)`, dialog surface (`var(--panel-high)` or the settings content background already used by the modal)

No new primitive. Adapt the background gallery accent-border idea to filled circles with a spacer ring so Mint-on-Mint remains readable.

## Changes

1. `web/src/settings.css` — `.accent-swatches button[aria-pressed="true"]`, `.accent-swatch[aria-pressed="true"]`, `.accent-swatch[aria-expanded="true"]`
   - Change: Remove `outline: 2px solid var(--text)` and `outline-offset: 3px`. Set selected border to `var(--accent)`. Add an outer spacer + accent ring via `box-shadow` (e.g. `0 0 0 2px <dialog surface>`, `0 0 0 4px var(--accent)`) so the accent ring does not disappear when fill === accent. Keep focus-visible behaviour on the dialog’s existing `:focus-visible` rules.
   - Preserve: 36×36 circular presets, interior ✓ + drop-shadow on the check span, transparent border on unselected chips, Custom palette disclosure and square colour fields untouched
   - Verify: Selected Mint (theme default accent) still shows a clear ring; Blue/Violet/etc. show accent ring + ✓; unselected chips have no ring

2. `web/src/AppearanceEditor.tsx` — Colours accent row
   - Change: none required unless the check span needs a class for contrast; prefer CSS-only
   - Preserve: preset names, colours, `aria-pressed`, click → palette accent update
   - Verify: pressing each swatch still updates accent and pressed state

3. Docs / tests
   - Change: none unless a visual/regression test asserts the old outline; update only if such an assertion exists
   - Preserve: `Settings.test.tsx` Appearance heading order Theme / Colours / Typography
   - Verify: existing settings tests still pass

## Scope

- Inherit: any future control that reuses `.accent-swatch` pressed/expanded styles
- Verify: Colour popover and overlay square tiles (must keep their own chrome; do not retarget `.colour-tile` / `.overlay-swatch`)
- Exclude: Theme Midnight/Daylight cards; Background gallery; Custom palette square inputs; sidebar active fill; overlay square tiles staying square

## Validation

- Product: Open Settings → Appearance → Colours; select each accent preset including Mint; selection reads as accent-ringed, not text-outlined
- Interface: light and dark theme; selected state + keyboard focus-visible; Custom palette open/closed unchanged
- System: selection matches accent-border language used by Background gallery; no parallel “text outline means selected” pattern left on accent chips
- Repository: from `web`, `npm test` → pass; optional visual check via app Settings modal

## Stop conditions

- Stop if SPEC changes accent swatches away from circular presets, or if selection for colour chips is redefined to a different owner than accent-border/wash language.
- Stop if a spacer ring on the dialog surface cannot be resolved without inventing a new global token — then use the nearest existing panel/background variable already applied inside `.settings-dialog` and document which one.

## Design documentation

- After acceptance and validation: in `SPEC.md` Settings refactor bullet on selection chrome, note that accent preset chips use accent-ring selection (with readable spacer) and interior check, not text-coloured outline.
