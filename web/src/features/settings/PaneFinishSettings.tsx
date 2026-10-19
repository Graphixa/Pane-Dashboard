import {
  Button,
  Range,
  Section,
  SettingsGroup,
} from "../../design/components";
import type { Config } from "../../model";
import { defaultGlass, normaliseGlass } from "../../appearance";
import { useAppearanceDraftHelpers, type DraftChange } from "./draftHelpers";

export default function PaneFinishSettings({
  draft,
  change,
}: {
  draft: Config;
  change: DraftChange;
}) {
  const g = normaliseGlass(draft.appearance.glass ?? defaultGlass);
  const { setGlass } = useAppearanceDraftHelpers(change);

  return (
      <>
        <Section level="h3" className="settings-section"
          title="Pane finish"
          tip={
            g.mode === "glass"
              ? "Clear panes with edge refraction where supported; text and icons stay opaque. Try low opacity and blur around 16–20 px."
              : "Opaque surfaces for a clear, uniform look."
          }
        >
          <div
            className="choice-row finish-choices"
            role="group"
            aria-label="Pane finish"
          >
            {(["solid", "glass"] as const).map((mode) => (
              <Button
                type="button"
                key={mode}
                aria-pressed={g.mode === mode}
                onClick={() => setGlass({ mode })}
              >
                {mode === "solid" ? "Solid" : "Glass"}
              </Button>
            ))}
          </div>
        </Section>
        {g.mode === "glass" && (
          <Section level="h3" className="settings-section"
            title="Fine tuning"
            tip="Adjust the transparency, blur and refraction of glass panes."
          >
            <SettingsGroup>
              <Range
                label="Opacity"
                value={g.opacity}
                min={0}
                max={100}
                unit="%"
                change={(opacity) => setGlass({ opacity })}
              />
              <Range
                label="Blur"
                value={g.blur}
                min={0}
                max={24}
                unit="px"
                change={(blur) => setGlass({ blur })}
              />
              <Range
                label="Saturation"
                value={g.saturation}
                min={0}
                max={100}
                unit="%"
                change={(saturation) => setGlass({ saturation })}
              />
              <Range
                label="Displacement"
                value={g.displacement}
                min={0}
                max={100}
                unit="%"
                change={(displacement) => setGlass({ displacement })}
              />
              <Range
                label="Chromatic aberration"
                value={g.aberration}
                min={0}
                max={100}
                unit="%"
                change={(aberration) => setGlass({ aberration })}
              />
            </SettingsGroup>
          </Section>
        )}
      </>
  );
}
