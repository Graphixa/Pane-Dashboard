import { ReactNode } from "react";

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(" ");

/** 16:9 by default for settings thumbnails and overlay tiles. */
export function AspectRatio({
  ratio = 16 / 9,
  className,
  children,
}: {
  ratio?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classes("ui-aspect-ratio", className)}
      style={{ aspectRatio: String(ratio) }}
    >
      {children}
    </div>
  );
}
