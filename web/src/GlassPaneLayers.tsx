import { useEffect, useId, useRef, useState } from "react";
import GlassFilters from "./GlassFilters";
import { buildGlassDisplacementMap } from "./glassDisplacementMap";
import type { GlassRefract } from "./useGlassQuality";

function elasticTransform(
  pane: DOMRect,
  mouse: { x: number; y: number },
  elasticity: number,
): string {
  if (elasticity <= 0) return "none";
  const cx = pane.left + pane.width / 2;
  const cy = pane.top + pane.height / 2;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  const edgeX = Math.max(0, Math.abs(dx) - pane.width / 2);
  const edgeY = Math.max(0, Math.abs(dy) - pane.height / 2);
  const edgeDist = Math.hypot(edgeX, edgeY);
  const zone = 220;
  if (edgeDist > zone) return "none";
  const fade = 1 - edgeDist / zone;
  const e = elasticity * fade;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const stretch = Math.min(dist / 300, 1) * e;
  const scaleX = Math.max(
    0.85,
    1 + Math.abs(nx) * stretch * 0.28 - Math.abs(ny) * stretch * 0.14,
  );
  const scaleY = Math.max(
    0.85,
    1 + Math.abs(ny) * stretch * 0.28 - Math.abs(nx) * stretch * 0.14,
  );
  const tx = dx * e * 0.08;
  const ty = dy * e * 0.08;
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
}

/** Empty warp + unfiltered tint. Observes the parent .pane for visibility. */
export default function GlassPaneLayers({
  paneId,
  onVisibleChange,
  mouse,
  elasticity,
  elasticEnabled,
  refract,
  displacement,
  aberration,
}: {
  paneId: string;
  onVisibleChange: (id: string, visible: boolean) => void;
  mouse: { x: number; y: number } | null;
  elasticity: number;
  elasticEnabled: boolean;
  refract: GlassRefract;
  displacement: number;
  aberration: number;
}) {
  const warpRef = useRef<HTMLSpanElement>(null);
  const reactId = useId().replace(/\W/g, "");
  const filterId = `pg${reactId || paneId.replace(/\W/g, "").slice(0, 12)}`;
  const [visible, setVisible] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    const pane = warpRef.current?.parentElement;
    if (!pane) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      onVisibleChange(paneId, true);
      return () => onVisibleChange(paneId, false);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        const next = !!entry?.isIntersecting;
        setVisible(next);
        onVisibleChange(paneId, next);
      },
      { root: null, rootMargin: "48px", threshold: 0.05 },
    );
    io.observe(pane);
    return () => {
      io.disconnect();
      onVisibleChange(paneId, false);
    };
  }, [paneId, onVisibleChange]);

  useEffect(() => {
    const pane = warpRef.current?.parentElement;
    if (!pane) return;
    if (visible) pane.setAttribute("data-glass-visible", "");
    else pane.removeAttribute("data-glass-visible");
  }, [visible]);

  useEffect(() => {
    const pane = warpRef.current?.parentElement as HTMLElement | null;
    if (!pane || !visible || refract === "off" || displacement <= 0) {
      setMapUrl(null);
      return;
    }
    const update = () => {
      const rect = pane.getBoundingClientRect();
      setMapUrl(buildGlassDisplacementMap(rect.width, rect.height));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [visible, refract, displacement, paneId]);

  useEffect(() => {
    const warp = warpRef.current;
    if (!warp) return;
    if (visible && refract !== "off" && mapUrl && displacement > 0) {
      warp.style.filter = `url(#${filterId})`;
    } else {
      warp.style.filter = "";
    }
  }, [visible, refract, mapUrl, displacement, filterId]);

  useEffect(() => {
    const pane = warpRef.current?.parentElement as HTMLElement | null;
    if (!pane) return;
    const layers = pane.querySelectorAll<HTMLElement>(
      ".pane-glass-warp, .pane-glass-tint, .pane-glass-shine, .pane-glass-rim, .app-grid",
    );
    const strength = elasticity / 100;
    if (!elasticEnabled || strength <= 0 || !mouse || !visible) {
      pane.classList.remove("pane-glass-elastic");
      layers.forEach((el) => {
        el.style.transform = "";
      });
      return;
    }
    pane.classList.add("pane-glass-elastic");
    const next = elasticTransform(
      pane.getBoundingClientRect(),
      mouse,
      strength,
    );
    layers.forEach((el) => {
      el.style.transform = next;
    });
  }, [mouse, elasticity, elasticEnabled, visible]);

  useEffect(
    () => () => {
      const pane = warpRef.current?.parentElement as HTMLElement | null;
      if (!pane) return;
      pane.classList.remove("pane-glass-elastic");
      pane
        .querySelectorAll<HTMLElement>(
          ".pane-glass-warp, .pane-glass-tint, .pane-glass-shine, .pane-glass-rim, .app-grid",
        )
        .forEach((el) => {
          el.style.transform = "";
        });
      const warp = warpRef.current;
      if (warp) warp.style.filter = "";
    },
    [],
  );

  return (
    <>
      {mapUrl && refract !== "off" && displacement > 0 && (
        <GlassFilters
          key={`${filterId}-${refract}-${displacement}-${aberration}-${mapUrl.slice(-24)}`}
          filterId={filterId}
          mapUrl={mapUrl}
          displacement={displacement}
          aberration={aberration}
          lite={refract === "lite"}
        />
      )}
      <span ref={warpRef} className="pane-glass-warp" aria-hidden="true" />
      <span className="pane-glass-tint" aria-hidden="true" />
      <span className="pane-glass-shine" aria-hidden="true" />
      <span
        className="pane-glass-rim pane-glass-rim-screen"
        aria-hidden="true"
      />
      <span
        className="pane-glass-rim pane-glass-rim-overlay"
        aria-hidden="true"
      />
    </>
  );
}
