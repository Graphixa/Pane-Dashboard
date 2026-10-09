// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ColourPopoverFields,
  hexToHsv,
  hsvToHex,
  parseHexInput,
  useDeferredColour,
} from "./colour";

describe("parseHexInput", () => {
  it("normalises and rejects invalid hex", () => {
    expect(parseHexInput("#AaBbCc")).toBe("#aabbcc");
    expect(parseHexInput("112233")).toBe("#112233");
    expect(parseHexInput("#12")).toBeNull();
    expect(parseHexInput("red")).toBeNull();
  });
});

describe("hexToHsv / hsvToHex", () => {
  it("round-trips saturated primaries used by the area picker", () => {
    expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
    expect(hexToHsv("#00ff00").h).toBe(120);
    const blue = hexToHsv("#0000ff");
    expect(hsvToHex(blue.h, blue.s, blue.v)).toBe("#0000ff");
  });
});

describe("useDeferredColour", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("paints live and commits once after the drag settles", () => {
    vi.useFakeTimers();
    const onColour = vi.fn();
    const paintLive = vi.fn();
    const { result } = renderHook(() =>
      useDeferredColour({
        colour: "#112233",
        onColour,
        paintLive,
      }),
    );

    act(() => {
      result.current.noteInput("#445566");
    });
    expect(paintLive).toHaveBeenCalledWith("#445566");
    expect(onColour).not.toHaveBeenCalled();
    expect(result.current.live).toBe("#445566");

    act(() => {
      result.current.noteInput("#778899");
    });
    expect(paintLive).toHaveBeenLastCalledWith("#778899");
    expect(onColour).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onColour).toHaveBeenCalledTimes(1);
    expect(onColour).toHaveBeenCalledWith("#778899");
  });

  it("keeps the live draft when a deferred parent commit arrives mid-drag", () => {
    vi.useFakeTimers();
    const onColour = vi.fn();
    const { result, rerender } = renderHook(
      ({ colour }) =>
        useDeferredColour({
          colour,
          onColour,
        }),
      { initialProps: { colour: "#112233" } },
    );

    act(() => {
      result.current.noteInput("#445566");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onColour).toHaveBeenCalledWith("#445566");

    act(() => {
      result.current.noteInput("#778899");
    });
    rerender({ colour: "#445566" });
    expect(result.current.live).toBe("#778899");
  });
});

describe("ColourPopoverFields", () => {
  it("exposes an accessible saturation area, hue slider and hex field", () => {
    const onSwatchChange = vi.fn();
    render(
      <ColourPopoverFields
        pickerLabel="Accent"
        swatchValue="#a2cbbb"
        hex="#a2cbbb"
        onHexChange={() => {}}
        onSwatchChange={onSwatchChange}
        onHexCommit={() => {}}
      />,
    );
    expect(
      screen.getByRole("slider", { name: "Accent saturation and brightness" }),
    ).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Accent hue" })).toBeTruthy();
    expect(screen.getByLabelText("Accent hex")).toBeTruthy();
    expect(document.querySelector(".colour-picker-area")).toBeTruthy();
  });
});
