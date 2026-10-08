import { useEffect, useRef, useState } from "react";
import { Button, SettingsRow } from "./components";
import { Input, Label } from "./controls";
import { Popover, PopoverHead } from "./overlays";

/** Normalise typed hex; return null when incomplete or invalid. */
export function parseHexInput(value: string): string | null {
  const next = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[a-fA-F0-9]{6}$/.test(next)) return null;
  return next.toLowerCase();
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
    const parent = colour.toLowerCase();
    if (pending.current && pending.current !== parent) {
      window.clearTimeout(commitTimer.current);
      pending.current = "";
    }
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
  return (
    <div className="colour-popover-body">
      <Label className="colour-popover-swatch">
        <Input
          type="color"
          aria-label={`Pick ${pickerLabel}`}
          value={swatchValue}
          onChange={(e) => onSwatchChange(e.target.value)}
        />
      </Label>
      <Label className="colour-popover-hex">
        <span>Hex</span>
        <Input
          spellCheck={false}
          maxLength={7}
          value={hex}
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
  );
}

/** Settings-row colour control: live paint while dragging, draft commit after settle. */
export function ColourField({
  label,
  colour,
  onColour,
  paintLive,
  hint,
}: {
  label: string;
  colour: string;
  onColour: (colour: string) => void;
  paintLive?: (colour: string) => void;
  hint?: string;
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
  return (
    <SettingsRow label={label} hint={hint}>
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
    </SettingsRow>
  );
}
