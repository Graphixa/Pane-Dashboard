# Colours shows a visible Accent group heading

Written against: d2b0f19

## Evidence chain

- Surface: Settings → Appearance → Colours
- Problem: Accent presets render as a bare swatch row under the section title “Colours”; “Accent” exists only in the section description and `aria-label`, while Custom palette is a visible disclosure and Background → Overlay groups swatches under visible `h4` labels. SPEC places custom palette fields “under Accent”, but Accent is not a readable on-screen group
- Design evidence: `SPEC.md` — “Custom palette keeps square colour fields under Accent”; Overlay “groups Solid, Gradient and Custom under small headings”; Overlay runtime exemplar `h4.overlay-group-label` in `web/src/AppearanceEditor.tsx`; inspiration `planning/inspiration/settings-cool.png` labels Theme then Custom under the colour controls
- Owner: `web/src/AppearanceEditor.tsx` Colours `Section` (accent swatch block before Custom palette disclosure)
- Scope and affected surfaces: Appearance → Colours only
- Uncertainty: none for adding a visible Accent label; copy is the Australian English word already used in SPEC and the Custom palette field label (“Accent”)

## Design decision

Add a visible `h4` **Accent** above the accent preset swatch row so Colours has the same group-label pattern as Overlay. Keep the Colours section title, section description, Custom palette disclosure, and square custom fields. Do not add nested tabs or a second settings nav.

## Reuse

- Structure exemplar: Overlay groups in `web/src/AppearanceEditor.tsx` (`h4` with class `overlay-group-label` above each swatch group)
- Typography exemplar: `.settings-section h4` / `.overlay-group-label` in `web/src/settings.css` (14px, weight 600, margin 0 0 8px for section h4; overlay-group-label matches that scale)
- Preferred markup: `<h4 className="overlay-group-label">Accent</h4>` or plain `<h4>Accent</h4>` inside `.settings-section` so existing `h4` rules apply — pick one and do not invent a third heading class

No new primitive. Reuse the Overlay small-heading pattern inside Colours.

## Changes

1. `web/src/AppearanceEditor.tsx` — Colours section, immediately before `.accent-swatches`
   - Change: Insert visible heading **Accent** (`h4`) above the swatch `role="group"` row. Keep `aria-label="Accent colour"` on the group (or tighten to avoid redundancy if the heading is associated via `aria-labelledby` — prefer wiring the group to the new heading id if straightforward; otherwise keep the aria-label and the visible h4).
   - Preserve: Section title “Colours”; description “Accent is used for buttons, selections and focus.”; preset buttons; Custom palette `<details>`; Reset colours; contrast error
   - Verify: Appearance page headings/groups read Theme → Colours → (Accent presets) → Custom palette → Typography; `Settings.test.tsx` still sees section h3s Theme / Colours / Typography only (do not break that test by promoting Accent to h3)

2. `web/src/settings.css`
   - Change: none required if reusing `.settings-section h4` or `.overlay-group-label`. If spacing between the new h4 and `.accent-swatches` is tight, adjust only `.accent-swatches` top margin so the gap matches Overlay’s label→swatches rhythm (`overlay-group` gap 8px), without changing section divider spacing
   - Preserve: section `+` dividers (36px / 32px); page title styles
   - Verify: Accent label sits under the Colours description and above the circles with clear, modest gap

3. Docs / tests
   - Change: update `SPEC.md` only to state that Colours exposes a small **Accent** subheading above the preset swatches (Custom palette remains a disclosure under that group). Update tests only if they query Colours structure and should assert the Accent label
   - Preserve: no nested tabs; Australian English “Colours” / “Accent”
   - Verify: `npm test` in `web` passes, including Appearance heading order

## Scope

- Inherit: readers of Colours; any copy that refers to “under Accent”
- Verify: Background → Overlay headings still correct; General Logo subsections unchanged
- Exclude: changing Custom palette into an always-open hex row; renaming Colours; adding Brand colour / Theme colour copy from inspiration; circular vs square rules for overlay/custom fields

## Validation

- Product: Open Settings → Appearance → Colours; user can see **Accent** as a group label above the circles, then Custom palette disclosure
- Interface: desktop and narrow settings layout; dark/light theme; screen reader still names the swatch group
- System: same small-heading pattern as Overlay; no new heading component
- Repository: from `web`, `npm test` → pass; confirm `Settings.test.tsx` Appearance h3 order remains `["Theme", "Colours", "Typography"]`

## Stop conditions

- Stop if Accent is mistakenly added as `h3` (would break section order tests and SPEC’s Theme / Colours / Typography section list).
- Stop if product direction moves accent presets out of Colours; reconcile instead of duplicating headings.

## Design documentation

- After acceptance and validation: in `SPEC.md` Appearance/Colours wording, record that preset swatches sit under a small **Accent** subheading, with Custom palette disclosure and square fields remaining under that group.
