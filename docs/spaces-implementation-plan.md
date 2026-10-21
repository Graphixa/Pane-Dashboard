# Spaces: phased implementation plan

Status: implemented on `feature/spaces` (exploratory — merge only after acceptance)

### Widget boundary (documented, not shipped)

`SpaceItem` is currently `PaneItem` only. Future widgets join that union with their own validators, geometry adapters and lifecycle rules. Inactive spaces must not keep hidden timers or pollers; space duplication must not imply shared live widget subscriptions. Do not accept placeholder widget types in production backups.  
Issue: [#16 — Feature: explore Spaces for multiple dashboard layouts](https://github.com/Graphixa/Pane-Dashboard/issues/16)  
Prepared: 11 October 2026  
Implementation baseline: `main` at `c571ec320b218572970901ec3d6e10f38ce58b55` (dynamic-backgrounds already merged)

## 1. Delivery boundary

Develop and evaluate Spaces on **`feature/spaces`** created from latest `main`. Do not land unfinished schema 4 on main. This issue is an exploration until explicitly accepted.

```sh
git switch main
git pull --ff-only
git switch -c feature/spaces
```

Read AGENTS.md, SPEC.md and DESIGN.md on the feature branch before continuing. All snippets below are target shapes; production types live in `web/src/model.ts` and `internal/config`.

## 2. Product contract

Spaces are named dashboard arrangements: Home, Work, Media, or Apps. Each can contain panes and eventually widgets. There is no Apps-space/Widgets-space discriminator.

| Concern | Owner |
| --- | --- |
| Branding, width, theme, glass, typography, wallpaper, tint/effects | Dashboard |
| App name, URL, icon, open-in-new-tab, Docker source identity | Shared app definition |
| Pane title, geometry and app slots | Pane instance within one space |
| Space name, order and default-space choice | Saved configuration |
| Active space, scroll position, focused tab, drag/editor state | Local browser/session UI |
| Future widget placement | Space; widget data ownership requires its own feature contract |

Use **Spaces** in user-facing copy; tabs show only their names. Keep the existing Background chooser and the polish direction in #15.

One Home space is the starting point. Hide the navigation strip in read mode while only one space exists. Desktop Edit mode must still expose New space and Manage spaces. Narrow presentation remains read-only; navigation remains available.

Selecting a tab never saves config. Structural edits use the existing edit autosave queue and its Saving/Saved/Not saved/Conflict feedback. Global Settings continues to use its draft and Apply/Cancel.

## 3. What the code currently does

| File | Existing behaviour and required adaptation |
| --- | --- |
| `web/src/model.ts` | Schema 4: shared `apps` catalogue + `spaces[]` with placements. Scope geometry helpers to one space. |
| `internal/config` | Go schema and strict validation mirror TypeScript. Overlaps only within each space. |
| `web/src/Dashboard.tsx` | Extract ActiveSpaceCanvas; keep global background/header outside it. |
| `web/src/layout.ts` | Grid constraints preserve pane geometry. Reuse them. |
| `web/src/features/apps/AppEditor.tsx`, `web/src/features/panes/PaneEditor.tsx` | Separate shared details from placement; carry space ID in editor context. |
| `web/src/useConfig.ts` | Whole-config change API (functional updater), 450 ms autosave, serialised saves and If-Match. |
| `web/src/features/settings/Settings.tsx` | Applies dashboard/appearance from its draft. Preserve spaces/catalogue/`dashboardId`/`defaultSpaceId`. |
| `web/src/ImportPanel.tsx` | Destination includes space; deduplicate shared app definitions by source identity. |
| `internal/config/store.go`, `cmd/pane`, `internal/api` | Conversion at load/import boundaries; ordinary PUT accepts schema 4 only. |
| `internal/archive`, `internal/config/background.go` | Portable backups and asset-reference collection across all spaces and the catalogue. |
| `web/src/design/components.tsx`, `controls.tsx`, `ComponentReference.tsx` | Shared entry point, Radix Tabs and Spaces strip reference examples. |

Schema 1/2 remain rejected. Schema 3 converts explicitly to schema 4 (one Home space) with an original-bytes backup. Pane-template interchange is reconciled to schema 4.

No widget renderer exists today. Do not make Spaces depend on one.

## 4. Proposed model

Prefer local pane instances and reusable app definitions. A pane shown in two spaces is two independently arranged pane instances. Only app details are shared. This keeps layout edits predictable.

Propose version 4, subject to the Phase 0 contract review:

```ts
// Reuse existing Geometry, Appearance and DashboardSettings shapes.
type AppDefinition = {
  id: string;
  name: string;
  url: string;
  icon: string;
  openInNewTab: boolean;
  source?: { provider: "docker"; id: string };
};

type AppPlacement = {
  id: string;           // identity of this appearance in a pane
  appId: string;        // reference to shared AppDefinition
  col: number;
  row: number;
};

type PaneItem = {
  id: string;
  type: "pane";
  title: string;
  layout: Geometry;    // keep current geometry units and frame adapter
  apps: AppPlacement[];
};

// Only accept implemented types. A future WidgetItem extends this union.
type SpaceItem = PaneItem;

type Space = {
  id: string;
  name: string;
  items: SpaceItem[];
};

type ConfigV4 = {
  version: 4;
  dashboardId: string;       // stable namespace for local preferences
  dashboard: DashboardSettings;
  appearance: Appearance;
  defaultSpaceId: string;
  apps: AppDefinition[];
  spaces: Space[];           // array order is tab order
};
```

Keep defaultSpaceId at the top level so it is owned by space management and is not accidentally overwritten by an older General Settings draft. Generate dashboardId once for a new dashboard/conversion; full backup restore preserves it. A full replacement re-resolves remembered selection against the new dashboard ID. Do not use display names or ETags as preference identities.

### Validation contract

Mirror the same rules in TypeScript and Go, including fixtures shared in meaning:
- At least one space; valid unique IDs; non-empty bounded names; defaultSpaceId resolves.
- Suggested exploration limits: **12 spaces**, **48 Unicode code points per space name**, **100 panes across all spaces**, **2,000 app definitions and 2,000 placements total**, and the existing **500 placements per pane** ceiling. These are proposed limits to freeze in Phase 0, not current product limits.
- Reject duplicate trimmed names case-insensitively using a defined matching algorithm shared by both validators. Use the same Unicode length rule in JS and Go; do not compare JS code units against Go byte lengths.
- Keep item and placement IDs globally unique in their own namespaces. App IDs are definition references, not placement IDs.
- Every appId resolves. Multiple placements may reference one definition. Every placement still needs a unique ID and an unoccupied, in-bounds slot.
- Compare item collisions within a space only. Identical coordinates in different spaces are valid.
- Global width changes validate **all spaces**, even though responsive presentation uses only the active one.
- Preserve fixed artwork, occupied minima, 8 px saved coordinates, 16 px movement, no compaction, no pushing neighbours and read-only mobile presentation.
- Reject unsupported item types and unknown fields; do not accept arbitrary widget configuration in anticipation of future work.
- Empty spaces are valid. Deleting a space removes its panes/placements, not catalogue definitions. Retain unused definitions so they can be placed again; a future catalogue deletion action must explicitly check every reference.

### Example: pure space-scoped operation

```ts
function updateSpace(
  current: ConfigV4,
  spaceId: string,
  update: (space: Space) => Space,
): ConfigV4 {
  const index = current.spaces.findIndex(s => s.id === spaceId);
  if (index < 0) throw new Error("This space no longer exists.");
  const next = structuredClone(current);
  next.spaces[index] = update(next.spaces[index]);
  validateV4(next); // validate full config, including references and all spaces
  return next;
}

function duplicateSpace(source: Space, name: string): Space {
  return {
    id: uid(),
    name,
    items: source.items.map(pane => ({
      ...structuredClone(pane),
      id: uid(),
      apps: pane.apps.map(slot => ({ ...slot, id: uid() })),
    })),
  };
}
```

Duplicating copies pane geometry and placements but keeps appId unchanged. The caller must check limits/name validity and insert the result through validated config mutation. Do not shallow-copy arrays that would couple the two layouts.

## 5. Phases and exit criteria

### Phase 0 — freeze behaviour and review the UI proposal

1. Create the feature branch and record the baseline.
2. Confirm the ownership table, schema version, bounded limits and shared-app editing semantics.
3. Agree the schema 3 conversion policy below. Update the feature branch's SPEC/AGENTS deliberately; do not silently reuse the previous Path A decision to discard current alpha users' schema 3 layouts.
4. Build temporary component-reference examples with one, three and twelve spaces, long names, an empty space and overflow. No production config calls.
5. Review dark/light themes and a narrow layout with an alpha tester.

**Exit:** product/model decisions are written down; shared UI examples explain selection and editing; no runtime configuration has changed.

### Phase 1 — model, validators, conversion and interchange

Do backend and frontend schema work as one coherent increment. Do not release a server accepting version 4 with a frontend that only understands version 3.

1. Add the proposed Go/TypeScript structures and validated reference lookup.
2. Extract pure per-space geometry checks from the current global validators. Keep whole-config bounds and quotas.
3. Add a strict schema 3 decoder used only by explicit conversion boundaries. Reject invalid schema 3 data before conversion.
4. Convert the old items into one Home space, preserving pane IDs, coordinates, capacity, app details, appearance and media references exactly. Old app IDs can become definition IDs; generate distinct stable placement IDs without deduplicating by URL or name. Two formerly separate apps must not become unexpectedly linked.
5. Use deterministic conversion identities or a recoverable conversion journal so retry does not create different duplicate definitions/placements.
6. Validate the complete result, write a unique backup of the **original bytes**, then use the existing atomic replacement pattern. If backup or conversion fails, leave the original file untouched. Do not overwrite a previous backup.
7. Establish the new revision from the actual converted config. A stale schema 3 client must not write schema 3 back over it. Ordinary PUT accepts only the runtime schema; conversion happens at startup and import preview.
8. Keep schema 1/2 backgrounds unsupported. A schema 3 → 4 converter is not a revival of the old migration chain.
9. Import preview performs conversion in memory without replacing saved config; only confirmed import enters the revision-protected save path.
10. Update full backups, shared exports and pane-template formats before exposing Spaces in the application.

Interchange rules:
- Full backup includes every space, shared definition, global setting and required local media.
- Shared dashboard exports strip URLs and source metadata from all included app definitions. Audit other existing private fields under the current export contract.
- A pane template includes its referenced app-definition subset. Import generates fresh pane, placement and definition IDs with an explicit old→new map; do not bind imported definitions to unrelated local IDs.
- Import templates into an explicit destination space at a free position there. Preserve intentional gaps and reject insufficient space atomically.
- Keep unsupported legacy templates clearly rejected or implement their bounded conversion deliberately; do not leave misleading legacy branches.
- Reference walkers must use catalogue definitions and all spaces. Avoid leaking unused private definitions into a shared pane export.

**Exit:** schema/validator parity, preserved schema 3 fixture, idempotent retry/failure checks, full backup round-trip and privacy-safe template/export tests pass.

### Phase 2 — make the existing Home dashboard space-aware

Do this before tab switching so single-space regressions are isolated.

1. Introduce app lookup selectors and a resolved render model. Keep resolved app fields out of persisted placements.
2. Extract an ActiveSpaceCanvas boundary from Dashboard.tsx. It receives the owning space ID, items, definition lookup and scoped callbacks; global Background/Header/Settings stay above it.
3. Adapt newPane, minimum, freePosition, moveApp, importApps, canPresent and editor updates. Collision/placement helpers operate on one space; whole-config validate checks all spaces.
4. Put spaceId into pane/app editor state and every mutation. Resolve the latest matching object by ID rather than writing a stale object snapshot.
5. Update useConfig.change to support a functional updater against current.current while retaining existing validation, serialisation, conflict blocking and unload protection. Read mode navigation never calls it.

Proposed signature after that refactor:
```ts
type ConfigChange =
  | ConfigV4
  | ((current: ConfigV4) => ConfigV4);

// In useConfig.change, after checking blocked/current:
// const next = typeof update === "function"
//   ? update(current.current)
//   : update;
// validateV4(next); then use the existing queue/status path.
```

Do not use an old render's full config to overwrite another edit. Settings Apply should merge only its intended dashboard/appearance fields into the latest config and validate all spaces. Preserve spaces, catalogue, dashboardId and defaultSpaceId.

Full-width editing currently changes saved dashboard width. Audit this carefully: adding in a narrow active space must not shrink global saved bounds and clip a different space. Width reductions require deliberate validation across all spaces.

**Exit:** the single Home space behaves like the current dashboard for creation, titles, app edits, imports, movement, resize, settings preview and saving; real-grid tests still pass.

### Phase 3 — switching and local navigation state

1. Add the shared Spaces navigation component and render it below the header, aligned to the dashboard's existing content width.
2. Use array order for tab order. Label the tab list “Spaces”; associate each tab with a named panel.
3. Resolve active ID from valid remembered ID → valid configured default → first space. No spaces should already be rejected by validation.
4. Store the last active ID under a key containing dashboardId. Handle unavailable/corrupt local storage with an in-memory fallback; never write preference failures to config.
5. Keep scroll in a session map keyed by space ID and presentation mode. Capture before switch; restore after the destination has rendered/measured, clamping to its scroll extent. Preserve access to the switcher when restoring deep scroll, for example by giving only the strip a sticky presentation with the proper header offset.
6. Use one mounted grid. Key it by space ID and reset preview/selected/drag/glass observer state on a successful switch. Keep background outside this keyed subtree so video does not restart.
7. Delay/reject switching during active drag/resize. A late layout event carries its originating space ID and interaction generation; discard it if that interaction was invalidated.
8. Open editors retain their original space identity. While a modal is open, use existing focus containment; any programmatic switch must go through its save/discard policy rather than silently closing it.
9. Do not use Ctrl/Cmd+T or Ctrl/Cmd+W. Use shared tabs keyboard behaviour and manual activation if rendering makes arrow-key activation noticeably expensive.

Resolver example:
```ts
function resolveActiveSpace(
  spaces: Space[],
  rememberedId: string | null,
  defaultSpaceId: string,
): string {
  const valid = new Set(spaces.map(s => s.id));
  if (rememberedId && valid.has(rememberedId)) return rememberedId;
  if (valid.has(defaultSpaceId)) return defaultSpaceId;
  if (!spaces.length) throw new Error("Configuration has no spaces.");
  return spaces[0].id;
}
```

Existing shared primitives can express the accessible navigation without mounting every canvas:
```tsx
<Tabs value={activeId} onValueChange={requestSpaceSwitch}>
  <TabsList aria-label="Spaces" className="space-tabs">
    {config.spaces.map(space => (
      <TabsTrigger key={space.id} value={space.id}>
        {space.name}
      </TabsTrigger>
    ))}
  </TabsList>
  {config.spaces.map(space => (
    <TabsContent key={space.id} value={space.id}>
      {space.id === activeId ? (
        <ActiveSpaceCanvas key={space.id} spaceId={space.id} />
      ) : null}
    </TabsContent>
  ))}
</Tabs>
```

This is structural pseudocode: provide the canvas's required data/callbacks and style overflow through the shared ScrollArea. Avoid moving panes as the strip appears; account for navigation height in edit-grid viewport calculations.

**Exit:** switching produces zero PUT requests, restores valid selection and scroll, keeps global backgrounds alive, and never applies stale geometry to another space.

### Phase 4 — space management and app reuse

1. Provide New space and Manage spaces in desktop Edit mode. When no tab strip is visible, the existing edit/add area still exposes New space.
2. Create empty or duplicate the active space. Use a name field with inline validation; select the successful result. Failed quota/name validation leaves config and active selection intact.
3. Implement rename and ordering in a shared management dialog. Provide Move left/right or Move earlier/later actions for keyboard users; pointer drag reordering is optional.
4. Let users set a default. Explain that it is used when that device has no remembered valid space; it does not forcibly switch another device.
5. Prevent final-space deletion. Confirm by name; if deleting the default, require a valid replacement as part of the same config mutation. Deleting the active space selects the replacement/default. Clean its local scroll entry after success.
6. Reuse current autosave and visible error/conflict handling. If saving fails, retain the pending local change and provide retry; do not falsely announce a server-saved deletion.
7. Separate app details (shared everywhere) from placement fields in AppEditor. Show brief helper copy when an app has several placements.
8. Add “Existing app” selection alongside creating a new app. Include unused retained definitions. Removing an app from a pane removes only that placement; catalogue-wide deletion is not required for this first increment.
9. Docker discovery recognises existing catalogue source IDs across all spaces. Offer placing an existing app instead of making it unselectable or duplicating its definition. A source identity match must not silently overwrite user-edited shared details.
10. Keep app moves across panes explicit and atomic. Cross-space drag-and-drop is out of scope; if the editor offers a destination space, validate both removal and destination insertion together.

**Exit:** a tester can create Apps and Work, place the same app in both, edit shared details, move one placement, duplicate a space and delete it without changing another layout.

### Phase 5 — visual finish, lifecycle and widget boundary

Use tokens and shared components; no additional UI library or layout engine.
- Tab text uses the label role; quiet inactive text, a clear active underline and distinct focus. Keep control targets at least the shared 40 px height.
- Align strip, header and canvas. Avoid large card backgrounds behind tabs, redundant “Spaces” headings, counts or browser-style close buttons.
- Long names truncate only with full accessible names retained; use shared overflow treatment and keep the active tab visible. One horizontal row works on narrow screens; do not wrap into a tall navigation block.
- Empty space: a short state and Add pane action in desktop Edit mode. In read/mobile mode, no mutation control.
- Preview real backgrounds and global glass; test reduced motion/transparency and strong contrast without introducing new per-space appearance.
- Give the management dialog clear verbs: New space, Rename space, Duplicate space, Delete space, Set as default.
- Keep per-space selection and draft state explicit rather than force-mounting hidden canvases.

Future widget boundary:
- Render implemented SpaceItem variants via an exhaustive switch. Add widget variants, validators, geometry adapters and lifecycle rules only when that widget feature is delivered.
- A widget placed beside a pane uses the same outer grid collision ownership; it does not need to masquerade as a pane with fake app slots.
- Define widget data sharing separately. Space duplication must not accidentally duplicate live subscriptions or imply that mutable widget data is shared.
- Inactive spaces must not maintain hidden polling/timers simply to preserve layout. Future widget state belongs in an explicit cache/model with cleanup on unmount.
- Prototype mixed item geometry with test/reference fixtures if useful; do not accept placeholder widget types in production backups.

**Exit:** visual/accessibility review is complete, only the active grid consumes work, and the extension boundary is documented without requiring widgets to ship.

### Phase 6 — verification and release decision

Run the repository-required checks from the feature branch:

```sh
cd web
npm ci
npm test
npm run build
```

At repository root:
```sh
go test ./...
go vet ./...
```

Retain CI's race/Docker checks. Add tests for actual risks, not snapshots of implementation details:

| Area | Required evidence |
| --- | --- |
| Model | Reference resolution; same coordinates across spaces allowed; overlap within a space rejected; quotas and final/default-space rules. |
| Shared apps | Definition edit visible in both spaces; placement move/removal isolated; duplicates have fresh instance IDs. |
| Conversion | Original bytes backed up; coordinates/details preserved; failed backup/write untouched; deterministic restart; schema 1/2 still rejected. |
| Grid | Actual drag/resize in two spaces; occupied slots/minima; stale events ignored; inactive layout unchanged. |
| Navigation | No config write on switch; missing remembered ID fallback; scroll restoration; mobile read-only; focus and overflow. |
| Persistence | Whole-config save covers all spaces; edits during in-flight save survive; 412 blocks mutations; retry retains pending state. |
| Settings | Apply changes global settings while preserving latest spaces/catalogue; Cancel restores appearance without erasing layout edits. |
| Import/export | Full multi-space round-trip; shared definition privacy; template ID remapping; selected-space Docker placement and deduplication. |
| Lifecycle | One canvas mounted; global video not restarted; observers/transient previews cleaned up. |

Browser review: both themes, bundled fonts, long names, 320 px viewport, 200% zoom, keyboard-only navigation/management, pointer grid editing, glass and reduced motion/transparency.

Ask an alpha tester to create separate Apps/Work layouts and explain back what is shared, what removal deletes and when changes save. Record confusion and whether a quiet tab strip is discoverable enough. Do not substitute DOM tests for this interaction review.

Update SPEC.md, DESIGN.md, AGENTS.md, component reference and import/backup docs with actual results. Record any unrun checks. Open a draft PR from feature/spaces with the migration decision and screenshots. Merge/release only after the exploration succeeds and the feature is explicitly accepted.

## 6. Main risks and decisions to keep visible

- **Shared app edits are new behaviour:** clearly distinguish definition edits from placement actions.
- **Schema work touches many paths:** audit every `config.items` / `c.items` / `c.Items` assumption, not only Dashboard.tsx.
- **Global width versus active layout:** use active-space bounds for presentation, all-space bounds for persisted validation.
- **Asynchronous state:** stale grids/editors/imports must carry identity and rebase updates on current config.
- **Backup privacy:** a new catalogue must not bypass sanitisation that previously walked embedded apps.
- **Scope:** Spaces should not become accounts, permissions, separate wallpapers, arbitrary widgets or a second dashboard engine.
- **Existing issues:** #12 and #15 can proceed independently; rebase rather than redefining their agreed Background direction.
