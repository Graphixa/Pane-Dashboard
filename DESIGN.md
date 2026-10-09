# Pane design system

This is the implementation contract for all new UI and changes to existing UI.
Read it with [SPEC.md](SPEC.md) before implementation. SPEC owns product behaviour,
layout geometry and persistence; this document owns visual roles and component
conventions. Do not resolve conflicts by silently changing either document.

## Sources of truth

| Concern | Source |
| --- | --- |
| Type, spacing, radii, focus and motion tokens | [tokens.css](web/src/design/tokens.css) |
| Shared React components and their public props | [components.tsx](web/src/design/components.tsx) |
| Shared component styles | [components.css](web/src/design/components.css) |
| Font loading and stylesheet order | [appStyles.ts](web/src/design/appStyles.ts) |
| Theme/custom palette resolution and validation | [appearance.ts](web/src/appearance.ts), [appearance.go](appearance.go) |
| Radix-backed interaction primitives and focus containment | [controls.tsx](web/src/design/controls.tsx), [overlays.tsx](web/src/design/overlays.tsx) |
| Interactive component reference | [ComponentReference.tsx](web/src/design/ComponentReference.tsx) |
| Fixed dashboard geometry | [model.ts](web/src/model.ts), [SPEC.md](SPEC.md#measurements) |

Run `npm ci` and `npm run dev` from `web`, then open
`http://localhost:5173/design-system.html` (use Vite's printed port if different).
The reference is also built into `web/dist/design-system.html` and served at
`/design-system.html` by Pane. It is a separate page with sample data: no API calls,
configuration reads/writes or persistent preferences. Do not add it as a Settings
preview or a new product navigation section.

## Design intent

Pane is a calm, compact app launcher. Prioritise recognisable apps, readable names,
clear navigation and predictable editing. Settings pages use typographic section
headings with inset `SettingsGroup` surfaces (label left, control right) rather than
decorative card chrome around the whole page. Keep descriptions short, use Australian
English and avoid promotional headings, counts or footer copy. Geist is the default
typeface; Rubik and Oxanium are supported alternatives across the whole UI. Changing
a typeface must not change the hierarchy or grid geometry.

## Typography

Choose a semantic role before writing JSX. Do not pick a new size per screen.
Sizes below assume a 16 px browser default. General UI uses rem tokens and must
remain usable when users increase text size or zoom. Do not fix the root size in px.

| Role | Size | Weight | Line height | Usage |
| --- | --- | --- | --- | --- |
| `title` | 1.5rem / 24 px | 600 | 1.3 | Dialog title or settings page title |
| `section` | 1.125rem / 18 px | 600 | 1.4 | Section headings |
| `label` | .875rem / 14 px | 600 | 1.5 | Field labels, subsection labels, action text |
| `body` | .875rem / 14 px | 400 | 1.5 | Input values and primary explanatory text |
| `support` | .8125rem / 13 px | 400 | 1.5 | Descriptions and validation help |
| `caption` | .75rem / 12 px | 400 | 1.5 | Navigation captions and compact metadata |
| Pane title | 18 px default; global 14–22 px | 700 | 24 px | Attached pane titles; preserve the 32 px title band |
| App label | 13 px | 400 | 18 px | Fixed app-cell geometry |
| Brand | 1.875rem / 30 px; compact 1.375rem / 22 px | 700 | Existing header geometry | Dashboard branding only |

- Load only the bundled 400, 600 and 700 font faces. Do not request 500, 550 or 650
  unless font assets, the table, components and reference are deliberately updated together.
- Title tracking is `--tracking-title` (-.02em); ordinary text uses normal tracking.
  Retain existing brand tracking as a branding exception. Do not letter-space small
  body text or use all caps for essential instructions.
- Heading level expresses document structure, not font size. Use `Text as="h2"
  variant="section"` where appropriate; never skip levels just to obtain a style.
- No new essential text below the caption size. Native `small`/`strong` must receive
  an explicit role if their browser defaults would change the intended appearance.
- Essential form labels, errors and instructions wrap. Only compact app names,
  pane titles and branding may truncate, with their full accessible name retained.
- Never shrink a font to make content fit. Change wrapping or available space.

## Spacing, surfaces and controls

Use the spacing tokens: 4, 8, 12, 16, 24, 32 and 48 px. Prefer 8 px between a label
and control, 16 px between related fields, 24 px between columns and 32 px between
sections. Existing fixed geometry is an explicit exception, not a second scale.

Control, pane/surface and dialog radii are 8, 14 and 18 px. Shared controls are at
least 40 px high and may grow for wrapped text; do not force a fixed height that
clips text. New icon-only actions use a 40 × 40 px target and an accessible name.
Existing dashboard drag/resize/title controls remain subject to SPEC geometry.
Use one primary action per action group. Secondary and quiet actions use the same
type size; destructive actions require explicit wording, not colour alone.

Keep icons visually consistent using the existing Lucide set (normally 18–20 px
for controls). Decorative icons are hidden from assistive technology. The fixed
80 px app artwork is not a control-icon size and must not be rescaled by UI tokens.

## Colour and themes

Continue using the runtime palette from `appearanceStyle`; do not create a second
palette in component CSS or Tailwind. Components consume these semantic variables:

| Variable | Meaning |
| --- | --- |
| `--bg` | Page/input background |
| `--panel` | Pane/dialog surface |
| `--panel-high` | Raised or secondary control surface |
| `--text` | Primary text |
| `--muted` | Supporting text; still must remain readable |
| `--line` | Decorative boundaries |
| `--accent` / `--accent-text` | Selected/primary fill and its paired foreground |
| `--danger-text` | Theme-aware error/destructive text; verify custom palettes |

Do not hard-code mint, white or dark text in new components. Keep client and server
palette validation aligned. Main text must meet the SPEC 4.5:1 requirement against
page and pane surfaces. Also check derived muted text, error text, focus indicators
and control boundaries in their actual context; existing palette validation does
not prove every derived colour combination is accessible. Never rely on colour
alone to communicate selected, error, success or disabled states.

Glass remains global and decorative. Never filter text, artwork or tint. Test
labels over actual backgrounds, including bright images. Reduced transparency
must produce a solid pane with no hidden-layer specificity failure. Reduced motion
must stop decorative movement. Keep solid fallbacks when filters
are unsupported. Do not use large inset bevels or claim physical refraction.

## Component contract

Import primitives from `web/src/design/components.tsx`. This is the only application-facing
component entry point. Its interaction primitives are built on Radix UI and are styled by
the Pane tokens; screens must not mix a second component library or bespoke copies.

| Component | Required usage |
| --- | --- |
| `Text` | Named `variant`; explicit `as` for headings/inline text |
| `Button` | `primary`, `secondary`, `quiet`, `danger` or `surface` (artwork/nav tiles); defaults to `type="button"` |
| `IconButton` | Required `label`, decorative icon child; retain label if visible text is hidden |
| `Field` | Render-prop wrapper for one custom control; spread generated ID/ARIA props onto it |
| `TextField` | Native input props plus `label`, optional `hint` and `error` |
| `SelectField` | Radix select props plus the same label/help/error contract |
| `SwitchRow` | Settings-style row: label (and optional hint) left, Radix switch right |
| `Notice` | `info`, `success` or `error`; optional `banner` for message plus inline actions |
| `Section` | Heading and optional description with consistent spacing; choose `h2` or `h3` |
| `SettingsGroup` | Inset grouped surface under a Section; holds SettingsRow, SwitchRow, Range or Disclosure rows |
| `SettingsRow` | Label (optional hint or Customize `action`) left, control right inside a SettingsGroup; omit label for a full-width control |
| `Modal` | Radix Dialog with required title and close handler; optional `placement` (`center` / `bottom`), `backdrop` (`dim` / `none`), and `headerClose` (`close` / `back`); caller owns discard policy |
| `ScrollArea` | Radix scrollport with themed scrollbar; use for horizontal strips and overflow panes instead of a raw overflow div |
| `Popover`, `PopoverHead`, `ImagePopoverActions`, `DropdownMenu` | Radix overlays for anchored and action menus; use the shared portal and surface styling. `Popover` sizes are `compact` (default, colour chips) and `image` (upload pickers). Colour pickers live-paint while open and commit the draft after the drag settles (`ColourField` / `useDeferredColour`); image pickers snapshot and restore on cancel — caller-owned, not merged. `PopoverHead` is the shared title + quiet close; `ImagePopoverActions` is the Cancel/OK footer for image pickers. |
| `ColourField`, `ColourPopoverFields`, `useDeferredColour` | Shared colour controls (DiceUI/Radix-style saturation–brightness area, hue slider and hex field). Prefer these over a raw `type="color"` input so Settings previews do not thrash on every drag tick. |
| `Select`, `Switch`, `Checkbox`, `Range`, `Disclosure` | Radix controls with Pane keyboard, focus and theme treatment |
| `useConfirmation` | Radix Alert Dialog; callers pass title, description, cancel and action labels for discard, delete or replace |

```tsx
import { Button, Section, SettingsGroup, SettingsRow, TextField } from "./design/components";

<Section title="General" level="h3">
  <SettingsGroup>
    <SettingsRow>
      <TextField
        label="Dashboard name"
        value={name}
        onChange={event => setName(event.target.value)}
        hint="Use a short, recognisable name."
        error={nameError}
      />
    </SettingsRow>
    <SettingsRow label="Actions">
      <Button type="submit" variant="primary" busy={saving}>
        {saving ? "Saving…" : "Apply settings"}
      </Button>
    </SettingsRow>
  </SettingsGroup>
</Section>
```

`busy` disables the action and sets `aria-busy`; supply meaningful busy text and
report the eventual result. Field errors set `aria-invalid` and are connected to
the control alongside hints through `aria-describedby`. Do not nest controls in
buttons or labels. Group related switches/radios with a fieldset and legend.

Do not render raw interactive HTML controls in production screens. Native elements
are implementation details inside this shared layer; this keeps semantics and
keyboard behaviour consistent while allowing Radix to own difficult interaction
state. When a primitive is missing, define its API and states, add it to this
module (or a focused module exported here), add a reference example and meaningful
interaction/accessibility tests, then migrate its consumers.

## Interaction and responsive behaviour

- Keyboard focus is visible: 2 px accent outline with a 3 px offset. Never remove
  an outline without providing a visible replacement. Check focus is not clipped.
- Preserve native form semantics through the shared controls. Submit actions explicitly use `type="submit"`.
- Selected controls expose `aria-pressed` or the appropriate native state. Current
  navigation uses `aria-current`. Hover must not be the only indication of meaning.
- Radix dialogs contain keyboard focus and support Escape. Return focus to the
  opener. Dirty Settings drafts must survive navigation and responsive preview;
  never dismiss or discard them as a side effect of a size calculation.
- Settings preview remains temporary; Cancel restores applied appearance. Reference
  examples never save. Preserve revision protection and user-visible save failures.
- At narrow widths and increased zoom, forms and action groups wrap. Keep important
  actions reachable. Desktop dashboard coordinates remain canonical; mobile stays
  read-only and never writes presentation coordinates.
- Decorative pointer animation must not drive whole-dashboard rendering. Keep
  geometry reads and transform writes batched and honour existing quality gates.

## CSS and contribution rules

1. Read this document and SPEC; choose roles/components before composing a screen.
2. Load styles through `design/appStyles.ts` in both entry points: fonts, tokens,
   legacy styles, then shared component styles. Avoid per-page import-order fixes.
3. New styles are component-scoped. Do not add global `label`, `button`, `h2` or
   `dialog p` rules. Existing globals are migration debt, not examples to copy.
4. Use tokens for visual values. Inline styles are reserved for runtime palette,
   user-configured values, measured layout geometry and genuine dynamic effects.
5. Do not override a shared component's font size, weight, padding or radius at its
   call site. Add a justified named variant centrally if the role truly differs.
6. Keep CSS specificity low and intentional. Do not accumulate override sheets or
   use `!important` to mask component conflicts. Existing grid-library constraints
   are explicitly documented geometry exceptions.
7. Every new variant has a reference example. Update this document and token table
   in the same change as a deliberate system-level design decision.
8. Tailwind is not required. Introducing it must preserve these semantic roles,
   palette resolution and components; arbitrary utilities must not bypass the system.

## Verification and adoption

Run `npm ci && npm test && npm run build` in `web`, then `go test ./... && go vet ./...`
at the repository root. Existing CI additionally runs race detection and Docker
build. Record any unavailable runtime or skipped browser checks in the PR.

For UI changes, inspect the reference and affected production screen with:

- Midnight and Daylight; Geist, Rubik and Oxanium; representative custom palettes.
- Desktop and narrow viewports (including 320 px), 200% zoom and long labels.
- Keyboard-only navigation, focus, disabled, busy, selected, validation and save-error states.
- Pane-title sizes 14, 18 and 22 px, labels on/off, and fixed 80 px app artwork.
- Reduced motion/transparency and solid fallback whenever glass/backgrounds change.

The reference is a review surface, not proof of accessibility or a replacement for
production-flow testing. The Radix migration is complete only when all production
screens use the shared entry point and the full verification matrix passes. A branch
must not claim a screen is migrated while it still owns raw interactive controls or
a duplicate overlay implementation.
