import { useEffect, useState } from "react";
import {
  alternateIconFormat,
  iconURL,
  iconURLForFormat,
  resolveIconFormat,
  type IconArtworkFormat,
} from "./appCatalogue";

type CatalogueIconImgProps = {
  icon: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  draggable?: boolean;
  /** Called after svg and png have both failed (or non-catalogue icon failed once). */
  onExhausted?: () => void;
};

/**
 * Renders dashboard-icons artwork with a one-shot format retry (svg↔png)
 * before reporting exhaustion to the parent.
 */
export function CatalogueIconImg({
  icon,
  className,
  width,
  height,
  loading = "lazy",
  draggable,
  onExhausted,
}: CatalogueIconImgProps) {
  const isCatalogue = icon.startsWith("dashboard-icons:");
  const slug = isCatalogue ? icon.slice("dashboard-icons:".length) : "";
  const initialFormat = isCatalogue ? resolveIconFormat(slug) : null;
  const [format, setFormat] = useState<IconArtworkFormat | null>(initialFormat);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setFormat(isCatalogue ? resolveIconFormat(slug) : null);
    setRetried(false);
  }, [icon, isCatalogue, slug]);

  const src =
    isCatalogue && format
      ? iconURLForFormat(slug, format)
      : iconURL(icon);

  return (
    <img
      className={className}
      src={src}
      alt=""
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onError={() => {
        if (isCatalogue && format && !retried) {
          setRetried(true);
          setFormat(alternateIconFormat(format));
          return;
        }
        onExhausted?.();
      }}
    />
  );
}
