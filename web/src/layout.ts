import { type LayoutConstraint } from "react-grid-layout/core";
import { GRID, MAX_ROWS } from "./model";

// Snap resize proposals to whole app rows/columns before RGL checks collisions.
export const tileResize: LayoutConstraint = {
  name: "whole-app-slots",
  constrainSize(item, w, h, _handle, context) {
    const maxCols = Math.min(32, Math.floor((context.cols - item.x - 4) / 14));
    const maxRows = Math.min(32, Math.floor((MAX_ROWS - item.y - 8) / 16));
    const cols = Math.max(
      Math.ceil(((item.minW ?? 18) - 4) / 14),
      Math.min(maxCols, Math.round((w - 4) / 14)),
    );
    const rows = Math.max(
      Math.ceil(((item.minH ?? 24) - 8) / 16),
      Math.min(maxRows, Math.round((h - 8) / 16)),
    );
    return { w: 4 + cols * 14, h: 8 + rows * 16 };
  },
};
export const gridWidth = (width: number) =>
  Math.floor(Math.min(3840, width) / GRID) * GRID;
