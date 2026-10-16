// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoWallpaper from "./VideoWallpaper";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoWallpaper", () => {
  it("keeps the video element when autoplay play() rejects", async () => {
    HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException("NotAllowedError"));
    HTMLMediaElement.prototype.pause = vi.fn();

    const { container } = render(
      <VideoWallpaper
        src="/media/builtin/neon-wave%40v1"
        position="center"
        playback="loop"
        paused={false}
      />,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector("video.scene-video")).toBeTruthy();
  });
});
