// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  assetIdFromMediaPath,
  capturePlayingVideoStill,
  clearVideoStillCache,
  peekVideoStill,
  putVideoPoster,
  seedVideoStillForTest,
  useVideoStill,
} from "./videoStillCache";
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
it("parses asset ids from media paths", () => {
  expect(assetIdFromMediaPath("/media/assets/abc123")).toBe("abc123");
  expect(assetIdFromMediaPath("/media/assets/abc123/poster")).toBe("abc123");
  expect(assetIdFromMediaPath("/media/builtin/x")).toBeUndefined();
});
it("puts video posters to the durable endpoint", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
  vi.stubGlobal("fetch", fetchMock);
  await expect(putVideoPoster("asset1", new Blob(["x"], { type: "image/jpeg" }))).resolves.toBe(true);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/media/poster/asset1",
    expect.objectContaining({ method: "PUT" }),
  );
});
