import {
  Section,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
} from "../../design/components";
import type { Config } from "../../model";
import { IntegerField } from "./IntegerField";
import { BrandingSection } from "./branding/BrandingSection";
import { useAppearanceDraftHelpers, type DraftChange } from "./draftHelpers";

export default function GeneralSettings({
  draft,
  change,
  onBusy,
  fieldErrors = {},
}: {
  draft: Config;
  change: DraftChange;
  onBusy: (b: boolean) => void;
  fieldErrors?: Record<string, string>;
}) {
  const a = draft.appearance;
  const { header, appearance } = useAppearanceDraftHelpers(change);

  return (
    <>
      <BrandingSection
        dashboard={draft.dashboard}
        onBusy={onBusy}
        fieldErrors={fieldErrors}
        onHeader={header}
      />
      <Section
        level="h3"
        className="settings-section"
        title="Labels"
        tip="Show or hide text beside header actions and under app icons."
      >
        <SettingsGroup>
          <SwitchRow
            label="Header buttons"
            checked={a.showButtonLabels}
            onCheckedChange={(checked) =>
              appearance({ showButtonLabels: checked })
            }
          />
          <SwitchRow
            label="App tiles"
            checked={a.showAppLabels}
            onCheckedChange={(checked) =>
              appearance({ showAppLabels: checked })
            }
          />
        </SettingsGroup>
      </Section>
      <Section
        level="h3"
        className="settings-section"
        title="Workspace"
        tip="Tiles keep their size. Narrow screens use a read-only layout."
      >
        <SettingsGroup>
          <SettingsRow label="Dashboard width">
            <Select
              aria-label="Dashboard width"
              value={
                draft.dashboard.widthMode === "full"
                  ? "full"
                  : [960, 1200].includes(draft.dashboard.width)
                    ? String(draft.dashboard.width)
                    : "custom"
              }
              onValueChange={(value) =>
                header({
                  widthMode: value === "full" ? "full" : "fixed",
                  width: ["960", "1200"].includes(value)
                    ? Number(value)
                    : value === "custom"
                      ? 1000
                      : draft.dashboard.width,
                })
              }
            >
              <SelectOption value="full">Full width</SelectOption>
              <SelectOption value="960">960 px</SelectOption>
              <SelectOption value="1200">1200 px</SelectOption>
              <SelectOption value="custom">Custom</SelectOption>
            </Select>
          </SettingsRow>
          <SettingsRow
            label={
              draft.dashboard.widthMode === "full" ? "Saved width" : "Width"
            }
            hint="Whole pixels from 768 to 3840."
          >
            <IntegerField
              label={
                draft.dashboard.widthMode === "full"
                  ? "Saved workspace width (px)"
                  : "Width (px)"
              }
              hideLabel
              min={768}
              max={3840}
              value={draft.dashboard.width}
              onCommit={(width) => header({ width })}
            />
          </SettingsRow>
        </SettingsGroup>
      </Section>
    </>
  );
}
