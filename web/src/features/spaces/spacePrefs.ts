/** Local (per-browser) active space preference — never written to config. */

const memory = new Map<string, string>();

function key(dashboardId: string) {
  return `pane-active-space:${dashboardId}`;
}

export function readRememberedSpace(dashboardId: string): string | null {
  try {
    return localStorage.getItem(key(dashboardId)) || memory.get(dashboardId) || null;
  } catch {
    return memory.get(dashboardId) || null;
  }
}

export function writeRememberedSpace(dashboardId: string, spaceId: string) {
  memory.set(dashboardId, spaceId);
  try {
    localStorage.setItem(key(dashboardId), spaceId);
  } catch {
    /* in-memory fallback only */
  }
}

export function resolveActiveSpace(
  spaces: { id: string }[],
  rememberedId: string | null,
  defaultSpaceId: string,
): string {
  const valid = new Set(spaces.map((s) => s.id));
  if (rememberedId && valid.has(rememberedId)) return rememberedId;
  if (valid.has(defaultSpaceId)) return defaultSpaceId;
  if (!spaces.length) throw new Error("Configuration has no spaces.");
  return spaces[0].id;
}
