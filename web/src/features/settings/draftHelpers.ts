import type { Config } from "../../model";
import {
  defaultBackground,
  defaultGlass,
  normaliseBackground,
  normaliseGlass,
  paletteForThemeChange,
  type Background as BackgroundConfig,
} from "../../appearance";

export type DraftChange = (c: Config | ((prev: Config) => Config)) => void;

export function useAppearanceDraftHelpers(change: DraftChange) {
  const header = (update: Partial<Config["dashboard"]>) =>
    change((prev) => ({
      ...prev,
      dashboard: { ...prev.dashboard, ...update },
    }));
  const appearance = (update: Partial<Config["appearance"]>) =>
    change((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...update },
    }));
  const setGlass = (update: Partial<ReturnType<typeof normaliseGlass>>) =>
    change((prev) => {
      const glass = normaliseGlass(prev.appearance.glass ?? defaultGlass);
      return {
        ...prev,
        appearance: { ...prev.appearance, glass: { ...glass, ...update } },
      };
    });
  const background = (update: Partial<BackgroundConfig>) =>
    change((prev) => {
      const cur = normaliseBackground(
        prev.appearance.background ?? defaultBackground,
      );
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          background: normaliseBackground({ ...cur, ...update }),
        },
      };
    });
  const setTheme = (theme: "dark" | "light") =>
    change((prev) => {
      const appearance = prev.appearance;
      return {
        ...prev,
        appearance: {
          ...appearance,
          theme,
          palette: paletteForThemeChange(
            appearance.theme,
            theme,
            appearance.palette,
          ),
          background: normaliseBackground(
            appearance.background ?? defaultBackground,
          ),
        },
      };
    });
  return { header, appearance, setGlass, background, setTheme };
}
