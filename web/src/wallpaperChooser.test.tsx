// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sortStaticBeforeLive, WallpaperTile } from "./wallpaperChooser";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sortStaticBeforeLive", () => {
  it("keeps static items before live while preserving relative order", () => {
    const items = [
      { id: "v1", kind: "video" as const },
      { id: "i1", kind: "image" as const },
      { id: "v2", kind: "video" as const },
      { id: "i2", kind: "image" as const },
    ];
    expect(sortStaticBeforeLive(items, (x) => x.kind).map((x) => x.id)).toEqual([
      "i1",
      "i2",
      "v1",
      "v2",
    ]);
  });
});

describe("WallpaperTile", () => {
  it("keeps live badge and selection check outside the aspect-ratio media frame", () => {
    const { container } = render(
      <WallpaperTile
        label="Clip"
        kind="video"
        pressed
        videoSrc="/media/clip.mp4"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const frame = container.querySelector(".wallpaper-tile-frame");
    const badge = container.querySelector(".wallpaper-tile-video-badge");
    const check = container.querySelector(".wallpaper-tile-check");
    expect(frame).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(check).toBeTruthy();
    expect(frame?.contains(badge)).toBe(false);
    expect(frame?.contains(check)).toBe(false);
    expect(badge?.textContent).toMatch(/Live/);
    expect(badge?.textContent).not.toMatch(/Video/);
    expect(screen.getByRole("button", { name: "Clip, live wallpaper" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Clip" })).toBeTruthy();
    expect(container.querySelector("video.wallpaper-tile-video")).toBeTruthy();
  });

  it("plays muted on hover and returns to still on leave", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    HTMLMediaElement.prototype.play = play;
    HTMLMediaElement.prototype.pause = pause;

    const { container } = render(
      <WallpaperTile
        label="Orbit"
        kind="video"
        videoSrc="/media/orbit.mp4"
        pressed={false}
        onSelect={vi.fn()}
      />,
    );
    const wrap = container.querySelector(".wallpaper-tile-wrap")!;
    fireEvent.mouseEnter(wrap);
    expect(play).toHaveBeenCalled();
    fireEvent.mouseLeave(wrap);
    expect(pause).toHaveBeenCalled();
  });

  it("skips hover playback when reduced motion is preferred", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = play;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { container } = render(
      <WallpaperTile
        label="Orbit"
        kind="video"
        videoSrc="/media/orbit.mp4"
        pressed={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.mouseEnter(container.querySelector(".wallpaper-tile-wrap")!);
    expect(play).not.toHaveBeenCalled();
  });
});
