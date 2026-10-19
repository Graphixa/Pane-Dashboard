import {
  Button,
  Input,
  Section,
  SettingsGroup,
  SettingsRow,
} from "../../../design/components";
import type { Config } from "../../../model";
import type { BuiltinIconId } from "../../../brandIcons";
import { BrandUrlPicker } from "./BrandUrlPicker";
import { LogoDropTarget } from "./LogoDropTarget";
import { IconBrandControl } from "./IconBrandControl";

export function BrandingSection({
  dashboard,
  onBusy,
  fieldErrors = {},
  onHeader,
}: {
  dashboard: Config["dashboard"];
  onBusy: (busy: boolean) => void;
  fieldErrors?: Record<string, string>;
  onHeader: (update: Partial<Config["dashboard"]>) => void;
}) {
  const hasCustomLogo = Boolean(dashboard.logo);
  const hasCustomIcon = Boolean(dashboard.icon);
  const titleVisible = hasCustomLogo ? true : dashboard.showTitle !== false;
  const iconVisible = dashboard.showIcon !== false;

  return (
    <Section
      level="h3"
      className="settings-section"
      title="Branding"
      tip="Page title also sets the browser tab. Optional wide logo replaces the title."
    >
      <SettingsGroup>
        <SettingsRow
          label="Page title"
          hint={
            hasCustomLogo ? "Custom logo replaces the page title." : undefined
          }
          action={
            <Button
              type="button"
              variant="quiet"
              className="settings-row-action"
              disabled={hasCustomLogo}
              aria-label={titleVisible ? "Hide page title" : "Show page title"}
              onClick={() => onHeader({ showTitle: !titleVisible })}
            >
              {titleVisible ? "Hide" : "Show"}
            </Button>
          }
        >
          <>
            <Input
              maxLength={100}
              value={dashboard.title}
              aria-label="Page title"
              data-settings-field="dashboard.title"
              aria-invalid={fieldErrors["dashboard.title"] ? true : undefined}
              aria-describedby={
                fieldErrors["dashboard.title"]
                  ? "dashboard.title-error"
                  : undefined
              }
              onChange={(e) => onHeader({ title: e.target.value })}
            />
            {fieldErrors["dashboard.title"] && (
              <p
                className="ui-field-error"
                id="dashboard.title-error"
                role="alert"
              >
                {fieldErrors["dashboard.title"]}
              </p>
            )}
          </>
        </SettingsRow>
        <SettingsRow
          className="icon-brand-row"
          label="Icon"
          action={
            <div className="settings-row-actions">
              <Button
                type="button"
                variant="quiet"
                className="settings-row-action"
                aria-label={iconVisible ? "Hide icon" : "Show icon"}
                onClick={() => onHeader({ showIcon: !iconVisible })}
              >
                {iconVisible ? "Hide" : "Show"}
              </Button>
              {hasCustomIcon ? (
                <Button
                  type="button"
                  variant="quiet"
                  className="settings-row-action"
                  aria-label="Remove custom icon"
                  onClick={() => onHeader({ icon: "" })}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          }
        >
          <IconBrandControl
            builtinIcon={dashboard.builtinIcon as BuiltinIconId | undefined}
            icon={dashboard.icon ?? ""}
            onBusy={onBusy}
            onBuiltin={(id) => onHeader({ builtinIcon: id, icon: "" })}
            onCustom={(icon) => onHeader({ icon })}
          />
        </SettingsRow>
        <SettingsRow
          className="logo-drop-row"
          label="Custom logo"
          hint="PNG, JPEG or WebP, up to 8 MiB. Replaces the page title."
          action={
            <div className="settings-row-actions">
              {hasCustomLogo ? (
                <Button
                  type="button"
                  variant="quiet"
                  className="settings-row-action"
                  aria-label="Remove custom logo"
                  onClick={() => onHeader({ logo: "" })}
                >
                  Remove
                </Button>
              ) : null}
              <BrandUrlPicker
                value={dashboard.logo ?? ""}
                onLive={(logo) => onHeader({ logo })}
              />
            </div>
          }
        >
          <LogoDropTarget
            logo={dashboard.logo ?? ""}
            onBusy={onBusy}
            onLive={(logo) => onHeader({ logo })}
          />
        </SettingsRow>
      </SettingsGroup>
    </Section>
  );
}
