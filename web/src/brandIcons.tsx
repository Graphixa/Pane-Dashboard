import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Server,
  PanelsTopLeft,
  House,
  LayoutDashboard,
  Boxes,
  Cloud,
  Database,
  HardDrive,
  Monitor,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";

/** Built-in header mark ids. Keep in sync with Go allow-list. */
export const builtinIconIds = [
  "grid",
  "server",
  "panels",
  "house",
  "dashboard",
  "boxes",
  "cloud",
  "database",
  "drive",
  "monitor",
  "rocket",
  "settings",
  "shield",
  "sparkles",
  "star",
  "terminal",
  "wifi",
  "zap",
] as const;

export type BuiltinIconId = (typeof builtinIconIds)[number];

/**
 * Icons shown in Settings Branding (2×6 grid). Custom upload is a sibling square.
 * Full `builtinIconIds` stay valid for existing configs and resolution.
 */
export const inlineBuiltinIconIds: readonly BuiltinIconId[] =
  builtinIconIds.slice(0, 12);

const icons: Record<BuiltinIconId, LucideIcon> = {
  grid: LayoutGrid,
  server: Server,
  panels: PanelsTopLeft,
  house: House,
  dashboard: LayoutDashboard,
  boxes: Boxes,
  cloud: Cloud,
  database: Database,
  drive: HardDrive,
  monitor: Monitor,
  rocket: Rocket,
  settings: Settings2,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  terminal: Terminal,
  wifi: Wifi,
  zap: Zap,
};

export function isBuiltinIconId(id: string): id is BuiltinIconId {
  return (builtinIconIds as readonly string[]).includes(id);
}

export function resolveBuiltinIcon(id?: string): LucideIcon {
  if (id && isBuiltinIconId(id)) return icons[id];
  return LayoutGrid;
}

export function brandShowsTitle(dashboard: {
  showTitle?: boolean;
  logo?: string;
}): boolean {
  if (dashboard.logo) return false;
  return dashboard.showTitle !== false;
}

export function brandShowsIcon(dashboard: { showIcon?: boolean }): boolean {
  return dashboard.showIcon !== false;
}
