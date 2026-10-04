# Working on Pane

Read [SPEC.md](SPEC.md) before changing behaviour. Pane is a single-user self-hosted launcher, not a general-purpose canvas or Docker manager.

- Keep the Go server small and the React state explicit. No database or second layout engine.
- React Grid Layout owns outer dragging, resizing and collision handling. CSS Grid owns app slots.
- Schema 2 stores x/y in 8 px units and w/h in app columns/rows. New placement and movement snap to 16 px; preserve existing coordinates until moved. Convert to library frame dimensions at the boundary only.
- Keep fixed 80 px icons, immediate 4 × 1 pane creation, attached external titles and 16 px gutters. Reserve title space in both modes. Centre the dotted move grip above the pane, keep resize marks perpendicular and offset, and fill the remaining viewport with the edit grid.
- Keep the header name/logo configurable, without promotional headings, counts or footer copy. Bundle Geist, Rubik and Oxanium locally (Geist default); title size defaults to 18 px, with a global 14–22 px setting. Missing app URLs must not dim artwork.
- Settings navigation is General, Appearance, Background, Panes, Import & backup, About. Keep logo/name in General, theme/colours/typography in Appearance, backgrounds on Background, and global finish plus app-label visibility in Panes. Preserve drafts across sections and validate all fields on Apply. Appearance and Background use typographic section headings, not nested tabs. Remove miniature settings previews. Preview draft dashboard/appearance live on the shell and Settings dialog without autosave; Cancel restores the prior applied look. Keep the Settings backdrop dimmed without blur. Keep sidebar icons and labels in fixed, left-aligned tracks.
- Appearance is global only: never introduce per-pane colours, glass or theme overrides. Brand mode is either a square icon plus name or a wide logo; keep the accessible name in both modes.
- Uploaded images are bounded, validated PNG/JPEG data images embedded in configuration for portable backups. Prepare images without persistence; Apply uses the ordinary revision-protected save. Never accept SVG/HTML uploads, arbitrary CSS or server-side fetching of user image URLs.
- Keep backgrounds decorative, respect reduced motion/transparency, and preserve solid-surface fallbacks. Global glass may use a layered liquid-glass surface (empty warp with backdrop blur and gated per-pane SVG edge refraction sized to each pane, unfiltered tint, soft shine/rim, optional cursor elasticity); never filter tint or content. Expose opacity/blur/saturation/displacement/aberration/elasticity under Panes fine tuning. Automatically degrade refraction for unsupported browsers, reduced motion/transparency, offscreen panes, edit drag/resize and many visible panes. Validate palette contrast on both client and server. Do not claim the glass finish is physical refraction.
- Preserve legacy configuration bytes in a unique backup before migration. Never silently truncate apps or overwrite an invalid configuration.
- Never compact layouts, push neighbours, swap occupied app slots, or persist mobile presentation coordinates.
- Read mode must not expose dashboard mutation controls. Edit mode is transient UI state, not authorisation.
- Preserve intentional gaps and reject geometry that clips an occupied app slot.
- Validate all configuration on both sides. Save atomically and preserve the previous file on failure.
- Docker discovery is opt-in and read-only. Never add Docker management endpoints or expose daemon responses wholesale.
- Keep URL handling restricted to HTTP(S). Do not render imported HTML.
- Use Australian English. Keep accessible names when button labels are hidden.
- Update tests and SPEC.md when behaviour changes. Run `npm ci && npm test && npm run build` in web, then `go test ./... && go vet ./...` at the root.
- Keep Docker socket access warnings prominent. Do not claim a read-only socket mount makes the Docker API read-only.
- Do not commit runtime configuration, credentials, node_modules, generated binaries or private service URLs.
