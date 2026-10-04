import { useEffect, useState } from "react";

export type GlassRefract = "full" | "lite" | "off";

/** Chromium-family only; Firefox/Safari get frost without displacement. */
export function glassRefractionCapable(): boolean {
  if (typeof navigator === "undefined" || typeof CSS === "undefined")
    return false;
  const ua = navigator.userAgent.toLowerCase();
  const firefox = ua.includes("firefox");
  const safari =
    ua.includes("safari") &&
    !ua.includes("chrome") &&
    !ua.includes("chromium") &&
    !ua.includes("edg");
  if (firefox || safari) return false;
  return (
    CSS.supports("backdrop-filter", "blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter", "blur(1px)")
  );
}

export function resolveGlassRefract(opts: {
  glassMode: boolean;
  capable: boolean;
  reducedMotion: boolean;
  interacting: boolean;
  visibleCount: number;
  manyPaneLimit?: number;
}): GlassRefract {
  if (
    !opts.glassMode ||
    !opts.capable ||
    opts.reducedMotion ||
    opts.interacting
  )
    return "off";
  // Lite only when the dashboard is genuinely crowded — 6 was too eager and
  // dropped the edge-masked full filter on typical home layouts.
  if (opts.visibleCount > (opts.manyPaneLimit ?? 14)) return "lite";
  return "full";
}

/** Shell-level refraction quality for always-on glass. */
export function useGlassQuality(opts: {
  glassMode: boolean;
  visibleCount: number;
  interacting: boolean;
}): GlassRefract {
  const [capable, setCapable] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setCapable(glassRefractionCapable());
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return resolveGlassRefract({
    glassMode: opts.glassMode,
    capable,
    reducedMotion,
    interacting: opts.interacting,
    visibleCount: opts.visibleCount,
  });
}
