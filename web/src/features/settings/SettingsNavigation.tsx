import type { LucideIcon } from "lucide-react";
import {
  Settings2,
  Palette,
  Image as ImageIcon,
  PanelsTopLeft,
  Archive,
  Info,
} from "lucide-react";
import { Button } from "../../design/components";
import type { SettingsPage } from "../../validation";

export const settingsPages = [
  ["general", "General", Settings2],
  ["appearance", "Appearance", Palette],
  ["background", "Background", ImageIcon],
  ["panes", "Panes", PanelsTopLeft],
  ["backup", "Import & backup", Archive],
  ["about", "About", Info],
] as const satisfies ReadonlyArray<readonly [SettingsPage, string, LucideIcon]>;

export type SettingsNavPage = (typeof settingsPages)[number][0];

export function SettingsNavigation({
  page,
  disabled,
  onNavigate,
}: {
  page: SettingsNavPage;
  disabled?: boolean;
  onNavigate: (page: SettingsNavPage) => void;
}) {
  return (
    <nav className="settings-sidebar" aria-label="Settings sections">
      {settingsPages.map(([id, label, Icon]) => (
        <Button
          type="button"
          key={id}
          className="ui-settings-nav"
          disabled={disabled}
          aria-current={page === id ? "page" : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </Button>
      ))}
    </nav>
  );
}
