/** Control kinds Pane knows how to render; packs may declare any number of params. */
export type DynamicControlType = "range" | "colour" | "toggle" | "select";

export type DynamicControl =
  | {
      key: string;
      label: string;
      type: "range";
      min: number;
      max: number;
      step?: number;
      default: number;
      cssVar: string;
      /** Map 0–100 style ranges onto animation duration in seconds. */
      map?: "duration";
    }
  | {
      key: string;
      label: string;
      type: "colour";
      default: string;
      cssVar: string;
    }
  | {
      key: string;
      label: string;
      type: "toggle";
      default: boolean;
      cssVar: string;
    }
  | {
      key: string;
      label: string;
      type: "select";
      default: string;
      cssVar: string;
      options: { value: string; label: string }[];
    };

export type DynamicManifest = {
  id: string;
  name: string;
  description?: string;
  controls: DynamicControl[];
};

export type DynamicPack = DynamicManifest & {
  css: string;
  fragment: string;
};

export type DynamicParamValue = number | string | boolean;
export type DynamicParams = Record<string, DynamicParamValue>;

export const DYNAMIC_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
export const DYNAMIC_KEY_RE = /^[a-z][a-z0-9-]{0,31}$/;
export const DYNAMIC_CSS_VAR_RE = /^--pane-[a-z0-9-]{1,48}$/;
