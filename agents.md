# Working on Pane

Read [SPEC.md](SPEC.md) before changing behaviour. Pane is a single-user self-hosted launcher, not a general-purpose canvas or Docker manager.

- Keep the Go server small and the React state explicit. No database or second layout engine.
- React Grid Layout owns outer dragging, resizing and collision handling. CSS Grid owns app slots.
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
