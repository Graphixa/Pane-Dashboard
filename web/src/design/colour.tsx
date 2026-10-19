import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Button, SettingsRow } from "./components";
import { Input, Label } from "./controls";
import { Popover, PopoverHead } from "./overlays";

/** Normalise typed hex; return null when incomplete or invalid. */
export function parseHexInput(value: string): string | null {
  const next = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[a-fA-F0-9]{6}$/.test(next)) return null;
  return next.toLowerCase();
}

type HSV = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** DiceUI-style conversions (hex ↔ HSV) for the shared Pane colour area. */
export function hexToHsv(hex: string): HSV {
  const raw = parseHexInput(hex) ?? "#000000";
  const r = Number.parseInt(raw.slice(1, 3), 16) / 255;
  const g = Number.parseInt(raw.slice(3, 5), 16) / 255;
  const b = Number.parseInt(raw.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : diff / max;
  return { h, s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const vv = clamp(v, 0, 100) / 100;
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = vv * (1 - ss);
  const q = vv * (1 - f * ss);
  const t = vv * (1 - (1 - f) * ss);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0:
      r = vv;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = vv;
      b = p;
      break;
    case 2:
      r = p;
      g = vv;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = vv;
      break;
    case 4:
      r = t;
      g = p;
      b = vv;
      break;
    default:
      r = vv;
      g = p;
      b = q;
      break;
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Live-paint during drag; commit the draft ~200ms after the last tick.
 * Same settle path as wallpaper tint and overlay custom colour.
 */
export function useDeferredColour({
  colour,
  onColour,
  paintLive,
}: {
  colour: string;
  onColour: (colour: string) => void;
  paintLive?: (colour: string) => void;
}) {
  const [live, setLive] = useState(colour);
  const [hex, setHex] = useState(colour);
  const colourRef = useRef(colour);
  const onColourRef = useRef(onColour);
  const paintRef = useRef(paintLive);
  const pending = useRef("");
  const commitTimer = useRef(0);
  colourRef.current = colour;
  onColourRef.current = onColour;
  paintRef.current = paintLive;

  const flush = () => {
    window.clearTimeout(commitTimer.current);
    const next = pending.current;
    pending.current = "";
    if (!next || next === colourRef.current.toLowerCase()) return;
    onColourRef.current(next);
  };

  useEffect(() => {
    // Do not clobber an in-flight drag when a deferred parent commit lands.
    if (pending.current) return;
    setLive(colour);
    setHex(colour);
  }, [colour]);

  useEffect(
    () => () => {
      window.clearTimeout(commitTimer.current);
      const next = pending.current;
      pending.current = "";
      if (next && next !== colourRef.current.toLowerCase())
        onColourRef.current(next);
    },
    [],
  );

  const noteInput = (value: string) => {
    const next = value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(next)) return;
    pending.current = next;
    setLive(next);
    setHex(next);
    paintRef.current?.(next);
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(flush, 200);
  };

  const applyHex = (value: string) => {
    const normalised = parseHexInput(value);
    if (!normalised) {
      setHex(colourRef.current);
      return;
    }
    window.clearTimeout(commitTimer.current);
    pending.current = "";
    setLive(normalised);
    setHex(normalised);
    paintRef.current?.(normalised);
    if (normalised !== colourRef.current.toLowerCase())
      onColourRef.current(normalised);
  };

  return { live, hex, setHex, noteInput, applyHex, flush };
}

/** Sticky HSV so hue survives near-grey S/V and popover reflow mid-drag. */
function useStickyHsv(colour: string) {
  const normalised = /^#[0-9a-fA-F]{6}$/.test(colour) ? colour.toLowerCase() : "#a2cbbb";
  const [hsv, setHsv] = useState(() => hexToHsv(normalised));
  const colourRef = useRef(normalised);
  useEffect(() => {
    if (normalised === colourRef.current) return;
    colourRef.current = normalised;
    const next = hexToHsv(normalised);
    setHsv((prev) =>
      next.s === 0 && next.v === 0
        ? { h: prev.h, s: next.s, v: next.v }
        : next.s === 0
          ? { h: prev.h, s: next.s, v: next.v }
          : next,
    );
  }, [normalised]);
  const commit = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    colourRef.current = hex;
    return hex;
  };
  return { hsv, commit };
}

/** 2D saturation/value area (DiceUI / Radix colour-picker pattern, Pane-themed). */
function ColourArea({
  hsv,
  colour,
  onHsv,
  label,
}: {
  hsv: HSV;
  colour: string;
  onHsv: (next: HSV) => void;
  label: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const setFromPoint = (clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
    onHsv({ h: hsvRef.current.h, s, v });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setFromPoint(e.clientX, e.clientY);
  };
  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1;
    let { s, v } = hsv;
    if (e.key === "ArrowRight") s += step;
    else if (e.key === "ArrowLeft") s -= step;
    else if (e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowDown") v -= step;
    else return;
    e.preventDefault();
    onHsv({ h: hsv.h, s: clamp(s, 0, 100), v: clamp(v, 0, 100) });
  };

  return (
    <div
      ref={areaRef}
      className="colour-picker-area"
      role="slider"
      tabIndex={0}
      aria-label={`${label} saturation and brightness`}
      aria-valuetext={`${colour}, saturation ${hsv.s}%, brightness ${hsv.v}%`}
      style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={onKeyDown}
    >
      <span className="colour-picker-area-white" aria-hidden="true" />
      <span className="colour-picker-area-black" aria-hidden="true" />
      <span
        className="colour-picker-area-thumb"
        aria-hidden="true"
        style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
      />
    </div>
  );
}

function ColourHueSlider({
  hsv,
  onHsv,
  label,
}: {
  hsv: HSV;
  onHsv: (next: HSV) => void;
  label: string;
}) {
  const id = useId();
  const hueName = `${label} hue`;
  return (
    <div className="colour-picker-hue">
      <span id={id} className="colour-picker-hue-label">
        {hueName}
      </span>
      <SliderPrimitive.Root
        className="colour-picker-hue-slider"
        min={0}
        max={360}
        step={1}
        value={[hsv.h]}
        onValueChange={([h]) => onHsv({ h, s: hsv.s, v: hsv.v })}
      >
        <SliderPrimitive.Track className="colour-picker-hue-track">
          <SliderPrimitive.Range className="colour-picker-hue-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="colour-picker-hue-thumb"
          aria-labelledby={id}
          style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        />
      </SliderPrimitive.Root>
    </div>
  );
}

export function ColourPopoverFields({
  pickerLabel,
  swatchValue,
  hex,
  onHexChange,
  onSwatchChange,
  onHexCommit,
}: {
  pickerLabel: string;
  swatchValue: string;
  hex: string;
  onHexChange: (value: string) => void;
  onSwatchChange: (value: string) => void;
  onHexCommit: (raw: string) => void;
}) {
  const live = /^#[0-9a-fA-F]{6}$/.test(swatchValue) ? swatchValue.toLowerCase() : "#a2cbbb";
  const { hsv, commit } = useStickyHsv(live);
  const paintHsv = (next: HSV) => {
    onSwatchChange(commit(next));
  };
  return (
    <div className="colour-popover-body colour-popover-picker">
      <ColourArea hsv={hsv} colour={live} onHsv={paintHsv} label={pickerLabel} />
      <ColourHueSlider hsv={hsv} onHsv={paintHsv} label={pickerLabel} />
      <div className="colour-popover-footer">
        <span
          className="colour-popover-swatch-preview"
          style={{ background: live }}
          aria-hidden="true"
        />
        <Label className="colour-popover-hex">
          <span>Hex</span>
          <Input
            spellCheck={false}
            maxLength={7}
            value={hex}
            aria-label={`${pickerLabel} hex`}
            onChange={(e) => onHexChange(e.target.value)}
            onBlur={(e) => onHexCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onHexCommit(e.currentTarget.value);
              }
            }}
          />
        </Label>
      </div>
    </div>
  );
}

/** Settings-row colour control: live paint while dragging, draft commit after settle. */
export function ColourField({
  label,
  colour,
  onColour,
  paintLive,
  hint,
  error,
  fieldPath,
}: {
  label: string;
  colour: string;
  onColour: (colour: string) => void;
  paintLive?: (colour: string) => void;
  hint?: string;
  error?: string;
  /** Stable Settings field path for focus routing after validation. */
  fieldPath?: string;
}) {
  const [open, setOpen] = useState(false);
  const { live, hex, setHex, noteInput, applyHex, flush } = useDeferredColour({
    colour,
    onColour,
    paintLive,
  });
  const close = () => {
    flush();
    setOpen(false);
  };
  const picking = open && live.toLowerCase() !== colour.toLowerCase();
  const shown = picking ? live : colour;
  const errorId = fieldPath ? `${fieldPath}-error` : undefined;
  return (
    <SettingsRow label={label} hint={hint}>
      <div className="colour-field">
        <Popover
          label={label}
          open={open}
          onOpenChange={(next) => {
            if (!next) flush();
            setOpen(next);
          }}
          trigger={
            <Button
              variant="surface"
              type="button"
              className="colour-field-trigger"
              aria-label={label}
              title={label}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              data-settings-field={fieldPath}
            >
              <span
                className="colour-field-swatch"
                style={{ background: shown }}
                aria-hidden="true"
              />
              <span className="colour-field-hex">{shown}</span>
            </Button>
          }
        >
          <PopoverHead
            title={label}
            closeLabel={`Close ${label} picker`}
            onClose={close}
          />
          <ColourPopoverFields
            pickerLabel={label}
            swatchValue={/^#[0-9a-f]{6}$/.test(live) ? live : colour}
            hex={hex}
            onHexChange={setHex}
            onSwatchChange={noteInput}
            onHexCommit={applyHex}
          />
        </Popover>
        {error && (
          <p className="ui-field-error" id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
    </SettingsRow>
  );
}
