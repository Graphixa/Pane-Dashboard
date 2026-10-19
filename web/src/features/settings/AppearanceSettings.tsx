import {
  Button,
  ColourField,
  Disclosure,
  Notice,
  Section,
  Select,
  SelectOption,
  SettingsGroup,
  SettingsRow,
} from "../../design/components";
import type { Config } from "../../model";
import {
  accentPresets,
  contrast,
  palettes,
  resolveUiFont,
  uiFontFamily,
  uiFonts,
  type UiFont,
} from "../../appearance";
import { IntegerField } from "./IntegerField";
import { useAppearanceDraftHelpers, type DraftChange } from "./draftHelpers";

export default function AppearanceSettings({
  draft,
  change,
  fieldErrors = {},
  openDisclosures = [],
  onDisclosureOpen,
}: {
  draft: Config;
  change: DraftChange;
  fieldErrors?: Record<string, string>;
  openDisclosures?: string[];
  onDisclosureOpen?: (title: string, open: boolean) => void;
}) {
  const a = draft.appearance;
  const p = a.palette ?? palettes[a.theme];
  const { appearance, setTheme } = useAppearanceDraftHelpers(change);
  const badContrast =
    contrast(p.text, p.surface) < 4.5 || contrast(p.text, p.background) < 4.5;

  return (
    <>
      <Section level="h3" className="settings-section"
        title="Theme"
        tip="Changing theme resets custom colours."
      >
        <div
          className="theme-choices choice-row"
          role="group"
          aria-label="Theme"
        >
          {(["dark", "light"] as const).map((theme) => (
            <Button
              key={theme}
              type="button"
              aria-pressed={a.theme === theme}
              onClick={() => setTheme(theme)}
            >
              <span
                className={`theme-thumbnail theme-${theme}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </span>
              {theme === "dark" ? "Midnight" : "Daylight"}
            </Button>
          ))}
        </div>
      </Section>
      <Section level="h3" className="settings-section"
        title="Colours"
        tip="Accent is used for buttons, selections and focus. Text contrast is checked before saving. Check glass over images."
      >
        <SettingsGroup>
          <SettingsRow label="Accent">
            <div
              className="accent-swatches"
              role="group"
              aria-label="Accent"
            >
              {accentPresets[a.theme].map(({ name, colour }) => (
                <Button variant="surface"
                  key={name}
                  type="button"
                  aria-label={name}
                  title={name}
                  aria-pressed={p.accent.toLowerCase() === colour.toLowerCase()}
                  className="accent-swatch"
                  style={{ background: colour }}
                  onClick={() => appearance({ palette: { ...p, accent: colour } })}
                >
                  <span aria-hidden="true">
                    {p.accent.toLowerCase() === colour.toLowerCase() ? "✓" : ""}
                  </span>
                </Button>
              ))}
            </div>
          </SettingsRow>
          <Disclosure
            title="Custom palette"
            open={openDisclosures.includes("Custom palette")}
            onOpenChange={(open) => onDisclosureOpen?.("Custom palette", open)}
          >
            {(
              [
                ["background", "Page"],
                ["surface", "Pane surface"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <ColourField
                key={key}
                label={label}
                colour={p[key]}
                fieldPath={`appearance.palette.${key}`}
                error={
                  key === "text"
                    ? fieldErrors["appearance.palette.text"]
                    : fieldErrors[`appearance.palette.${key}`]
                }
                onColour={(colour) =>
                  appearance({ palette: { ...p, [key]: colour } })
                }
              />
            ))}
          </Disclosure>
          {badContrast && !fieldErrors["appearance.palette.text"] && (
            <SettingsRow>
              <Notice tone="error">
                {! (contrast(p.text, p.surface) >= 4.5) &&
                !(contrast(p.text, p.background) >= 4.5)
                  ? "Text needs at least 4.5:1 contrast against the page and pane colours."
                  : !(contrast(p.text, p.surface) >= 4.5)
                    ? "Text needs at least 4.5:1 contrast against the pane surface colour."
                    : "Text needs at least 4.5:1 contrast against the page colour."}
              </Notice>
            </SettingsRow>
          )}
          <SettingsRow>
            <Button variant="surface"
              type="button"
              className="text-button"
              disabled={!a.palette}
              onClick={() => appearance({ palette: undefined })}
            >
              Reset colours
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </Section>
      <Section level="h3" className="settings-section"
        title="Typography"
        tip="Bundled typefaces for the whole dashboard. Pane titles also use the size below."
      >
        <SettingsGroup>
          <SettingsRow label="Font">
            <Select
              value={resolveUiFont(a.fontFamily)}
              style={{ fontFamily: uiFontFamily(resolveUiFont(a.fontFamily)) }}
              aria-label="Font"
              onValueChange={(value) => {
                if (!uiFonts.some((font) => font.id === value)) return;
                appearance({ fontFamily: value as UiFont });
              }}
            >
              {uiFonts.map((font) => (
                <SelectOption
                  key={font.id}
                  value={font.id}
                  style={{ fontFamily: font.family }}
                >
                  {font.label}
                </SelectOption>
              ))}
            </Select>
          </SettingsRow>
          <SettingsRow>
            <IntegerField
              label="Pane title size (px)"
              min={14}
              max={22}
              value={a.paneTitleSize ?? 18}
              onCommit={(paneTitleSize) => appearance({ paneTitleSize })}
            />
          </SettingsRow>
        </SettingsGroup>
      </Section>
    </>
  );
}
