import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { dynamicCssVars } from "./params";
import { getDynamicPack } from "./registry";
import type { DynamicParams } from "./types";

const injected = new Map<string, string>();

function ensurePackStyle(packId: string, css: string) {
  if (typeof document === "undefined") return;
  const prev = injected.get(packId);
  if (prev === css) return;
  let el = document.getElementById(
    `pane-dynamic-style-${packId}`,
  ) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = `pane-dynamic-style-${packId}`;
    document.head.append(el);
  }
  el.textContent = css;
  injected.set(packId, css);
}

export default function DynamicScene({
  dynamicId,
  params,
  paused,
  gradientPaint,
}: {
  dynamicId: string;
  params: DynamicParams;
  paused: boolean;
  /** Fallback / base fill behind the pack (gradient preset paint). */
  gradientPaint: string;
}) {
  const pack = getDynamicPack(dynamicId);
  const host = useRef<HTMLDivElement>(null);
  const vars = useMemo(
    () => (pack ? dynamicCssVars(pack, params) : {}),
    [pack, params],
  );

  useEffect(() => {
    if (pack) ensurePackStyle(pack.id, pack.css);
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
      className={`scene-dynamic${paused ? " motion-paused" : ""}`}
      data-dynamic-id={pack.id}
      style={
        {
          ...vars,
          background: gradientPaint,
        } as CSSProperties
      }
    />
  );
}
