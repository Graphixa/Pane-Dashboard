// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { capturePlayingVideoStill, clearVideoStillCache, peekVideoStill, seedVideoStillForTest, useVideoStill } from "./videoStillCache";
afterEach(() => { cleanup(); clearVideoStillCache(); vi.restoreAllMocks(); });
it("updates subscribers and never reuses a still for a different source", () => {
  const { result, rerender } = renderHook(({ src }) => useVideoStill(src), { initialProps: { src: "one" } });
  expect(result.current).toBeUndefined();
  act(() => seedVideoStillForTest("one", "blob:one"));
  expect(result.current).toBe("blob:one");
  rerender({ src: "two" });
  expect(result.current).toBeUndefined();
});
it("ignores incomplete frames without creating a second video", () => {
  const video = document.createElement("video");
  const create = vi.spyOn(document, "createElement");
  capturePlayingVideoStill("one", video);
  expect(create).not.toHaveBeenCalled();
  expect(peekVideoStill("one")).toBeUndefined();
});
it("bounds the session cache", () => {
  for (let i = 0; i < 33; i++) seedVideoStillForTest(String(i), `blob:${i}`);
  expect(peekVideoStill("0")).toBeUndefined();
  expect(peekVideoStill("32")).toBe("blob:32");
});
