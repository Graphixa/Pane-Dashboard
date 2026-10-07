import { useEffect, useId, useRef, useState } from "react";
import GlassFilters from "./GlassFilters";
import { buildGlassDisplacementMap } from "./glassDisplacementMap";
import type { GlassRefract } from "./useGlassQuality";

/** Empty warp + unfiltered tint. Observes the parent .pane for visibility. */
export default function GlassPaneLayers({
  paneId,
  onVisibleChange,
  refract,
  displacement,
  aberration,
}: {
  paneId: string;
  onVisibleChange: (id: string, visible: boolean) => void;
  refract: GlassRefract;
  displacement: number;
  aberration: number;
}) {
  const warpRef = useRef<HTMLSpanElement>(null);
  const mapUrlRef = useRef<string | null>(null);
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
    const pane = warpRef.current?.parentElement as HTMLElement | null;
    if (!pane || !visible || refract === "off" || displacement <= 0) {
      mapUrlRef.current = null;
      setMapUrl(null);
      return;
    }
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = pane.getBoundingClientRect();
        const next = buildGlassDisplacementMap(rect.width, rect.height);
        if (next === mapUrlRef.current) return;
        mapUrlRef.current = next;
        setMapUrl(next);
      });
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver(update);
    ro.observe(pane);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
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

  useEffect(
    () => () => {
      const warp = warpRef.current;
      if (warp) warp.style.filter = "";
    },
    [],
  );

  return (
    <>
      {mapUrl && refract !== "off" && displacement > 0 && (
        <GlassFilters
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
