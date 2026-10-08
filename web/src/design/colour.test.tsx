// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHexInput, useDeferredColour } from "./colour";

describe("parseHexInput", () => {
  it("normalises and rejects invalid hex", () => {
    expect(parseHexInput("#AaBbCc")).toBe("#aabbcc");
    expect(parseHexInput("112233")).toBe("#112233");
    expect(parseHexInput("#12")).toBeNull();
    expect(parseHexInput("red")).toBeNull();
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
});
