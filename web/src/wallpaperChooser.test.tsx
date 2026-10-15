// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_HOVER_PREVIEW_MS,
  sortStaticBeforeLive,
  WallpaperTile,
} from "./wallpaperChooser";
import { clearVideoStillCache, seedVideoStillForTest } from "./videoStillCache";

beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {}); });

afterEach(() => {
  cleanup();
  clearVideoStillCache();
  vi.useRealTimers();
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
  it("does not create hidden video downloads for uncached idle uploads", () => {
    const create = vi.spyOn(document, "createElement");
    render(<WallpaperTile label="Upload" kind="video" videoSrc="/media/assets/new" pressed={false} onSelect={vi.fn()} />);
    expect(create.mock.calls.filter(([tag]) => tag === "video")).toHaveLength(0);
  });

  it("keeps idle live tiles on thumb with no video element", () => {
    const { container } = render(
      <WallpaperTile
        label="Clip"
        kind="video"
        pressed
        src="/media/clip-thumb.webp"
        videoSrc="/media/clip.mp4"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Clip, live wallpaper" })).toBeTruthy();
    expect(container.querySelector("img.wallpaper-tile-image")?.getAttribute("src")).toBe(
      "/media/clip-thumb.webp",
    );
    expect(container.querySelector("video")).toBeNull();
  });

  it("debounces hover before mounting video; leave cancels pending start", async () => {
    vi.useFakeTimers();
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    HTMLMediaElement.prototype.play = play;
    HTMLMediaElement.prototype.pause = pause;

    const { container } = render(
      <WallpaperTile
        label="Clip"
        kind="video"
        pressed
        src="/media/clip-thumb.webp"
        videoSrc="/media/clip.mp4"
        onSelect={vi.fn()}
      />,
    );
    const wrap = container.querySelector(".wallpaper-tile-wrap")!;

    fireEvent.mouseEnter(wrap);
    expect(container.querySelector("video")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(container.querySelector("video")).toBeNull();

    fireEvent.mouseLeave(wrap);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(container.querySelector("video")).toBeNull();
    expect(play).not.toHaveBeenCalled();

    fireEvent.mouseEnter(wrap);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_HOVER_PREVIEW_MS);
    });
    const video = container.querySelector("video.wallpaper-tile-video");
    expect(video?.getAttribute("src")).toBe("/media/clip.mp4");
    expect(play).toHaveBeenCalled();
    // Thumb stays until the video reports playing (no black flash).
    expect(container.querySelector("img.wallpaper-tile-image")).toBeTruthy();
  });

  it("mounts video immediately on keyboard focus", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = play;

    const { container } = render(
      <WallpaperTile
        label="Focus clip"
        kind="video"
        pressed={false}
        src="/media/clip-thumb.webp"
        videoSrc="/media/clip.mp4"
        onSelect={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole("button", { name: "Focus clip, live wallpaper" }));
    expect(container.querySelector("video.wallpaper-tile-video")?.getAttribute("src")).toBe(
      "/media/clip.mp4",
    );
    expect(play).toHaveBeenCalled();
    expect(container.querySelector("img.wallpaper-tile-image")).toBeTruthy();
  });

  it("uses captured still for My media uploads once cached", async () => {
    vi.useFakeTimers();
    seedVideoStillForTest("/media/assets/abc", "blob:upload-still");
    const play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = play;

    const { container } = render(
      <WallpaperTile
        label="Upload"
        kind="video"
        videoSrc="/media/assets/abc"
        pressed={false}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector("img.wallpaper-tile-image")?.getAttribute("src")).toBe(
      "blob:upload-still",
    );
    expect(container.querySelector("video")).toBeNull();

    fireEvent.mouseEnter(container.querySelector(".wallpaper-tile-wrap")!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_HOVER_PREVIEW_MS);
    });
    expect(container.querySelector("video.wallpaper-tile-video")).toBeTruthy();
    expect(play).toHaveBeenCalled();
    expect(container.querySelector("img.wallpaper-tile-image")).toBeTruthy();
  });

  it("skips hover playback when reduced motion is preferred", async () => {
    vi.useFakeTimers();
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
        src="/media/orbit-thumb.webp"
        videoSrc="/media/orbit.mp4"
        pressed={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.mouseEnter(container.querySelector(".wallpaper-tile-wrap")!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(play).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toBeNull();
  });

  it("lazy loads static thumbnails", () => {
    const { container } = render(
      <WallpaperTile
        label="Forest"
        kind="image"
        src="/media/forest.jpg"
        pressed={false}
        onSelect={vi.fn()}
      />,
    );
    const img = container.querySelector("img.wallpaper-tile-image");
    expect(img?.getAttribute("src")).toBe("/media/forest.jpg");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("video")).toBeNull();
  });
});
