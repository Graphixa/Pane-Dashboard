/** Structured client validation for Settings field routing (not security). */

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export class ConfigValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    const list = issues.length ? issues : [{ path: "", code: "invalid", message: "Invalid configuration." }];
    super(list[0].message);
    this.name = "ConfigValidationError";
    this.issues = list;
  }
}

export function fail(path: string, code: string, message: string): never {
  throw new ConfigValidationError([{ path, code, message }]);
}

export type SettingsPage =
  | "general"
  | "appearance"
  | "background"
  | "panes"
  | "backup"
  | "about";

/** Map a field path to a Settings sidebar page and optional disclosure title. */
export function settingsTarget(issue: ValidationIssue): {
  page: SettingsPage | null;
  disclosure: string | null;
  focusable: boolean;
} {
  const { path } = issue;
  if (
    !path ||
    path === "version" ||
    path === "items" ||
    path.startsWith("items.") ||
    path === "spaces" ||
    path.startsWith("spaces.") ||
    path === "apps" ||
    path.startsWith("apps.") ||
    path === "dashboardId" ||
    path === "defaultSpaceId"
  )
    return { page: null, disclosure: null, focusable: false };
  if (path.startsWith("dashboard."))
    return { page: "general", disclosure: null, focusable: true };
  if (path.startsWith("appearance.background"))
    return { page: "background", disclosure: null, focusable: true };
  if (path.startsWith("appearance.glass"))
    return { page: "panes", disclosure: null, focusable: true };
  if (path.startsWith("appearance.palette"))
    return { page: "appearance", disclosure: "Custom palette", focusable: true };
  if (
    path === "appearance.showAppLabels" ||
    path === "appearance.showButtonLabels"
  )
    return { page: "general", disclosure: null, focusable: true };
  if (path.startsWith("appearance."))
    return { page: "appearance", disclosure: null, focusable: true };
  return { page: null, disclosure: null, focusable: false };
}

/** Navigation order for picking the first Settings issue to surface. */
const pageOrder: SettingsPage[] = [
  "general",
  "appearance",
  "background",
  "panes",
  "backup",
  "about",
];

export function firstSettingsIssue(
  issues: ValidationIssue[],
): ValidationIssue | null {
  let best: { issue: ValidationIssue; rank: number } | null = null;
  for (const issue of issues) {
    const { page, focusable } = settingsTarget(issue);
    if (!page || !focusable) continue;
    const rank = pageOrder.indexOf(page);
    if (!best || rank < best.rank) best = { issue, rank };
  }
  return best?.issue ?? null;
}
