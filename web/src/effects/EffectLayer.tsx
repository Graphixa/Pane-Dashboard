import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Effect } from "../appearance";
import { effectCssVars, getEffectPack } from "./registry";

const injected = new Map<string, string>();

function ensureEffectStyle(id: string, css: string) {
  if (typeof document === "undefined") return;
  if (injected.get(id) === css) return;
  let el = document.getElementById(
    `pane-effect-style-${id}`,
  ) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = `pane-effect-style-${id}`;
    document.head.append(el);
  }
  el.textContent = css;
  injected.set(id, css);
}

export default function EffectLayer({
  effect,
  paused,
}: {
  effect: Effect;
  paused: boolean;
}) {
  const pack = getEffectPack(effect.id);
  const host = useRef<HTMLDivElement>(null);
  const vars = useMemo(
    () => (pack ? effectCssVars(pack, effect.params ?? {}) : {}),
    [pack, effect.params],
  );

  useEffect(() => {
    if (pack) ensureEffectStyle(pack.id, pack.css);
  }, [pack]);

  useEffect(() => {
    const el = host.current;
    if (!el || !pack) return;
    el.innerHTML = pack.fragment;
  }, [pack]);

  if (!pack) return null;

  return (
    <div
      ref={host}
      className={`scene-effect${paused ? " motion-paused" : ""}`}
      data-effect-id={pack.id}
      style={vars as CSSProperties}
    />
  );
}
