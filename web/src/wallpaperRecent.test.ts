/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  RECENT_WALLPAPER_KEY,
  flushPendingRecentWallpaper,
  loadRecentWallpapers,
  pruneRecentMediaRef,
  queueRecentWallpaperOnSave,
  recordRecentWallpaper,
  wallpaperIdentityKey,
} from "./wallpaperRecent";

afterEach(() => {
  localStorage.removeItem(RECENT_WALLPAPER_KEY);
  queueRecentWallpaperOnSave(undefined);
});

describe("wallpaperRecent", () => {
  it("deduplicates and caps at eight", () => {
    for (let i = 0; i < 10; i++) {
      recordRecentWallpaper({ kind: "solid", colour: `#${i}${i}${i}${i}${i}${i}` });
    }
    recordRecentWallpaper({ kind: "gradient", preset: "ocean" });
    recordRecentWallpaper({ kind: "gradient", preset: "ocean" });
    const list = loadRecentWallpapers();
    expect(list.length).toBeLessThanOrEqual(8);
    expect(list.filter((e) => e.key === "gradient:ocean")).toHaveLength(1);
    expect(list[0].key).toBe("gradient:ocean");
  });

  it("only flushes pending after matching successful save", () => {
    queueRecentWallpaperOnSave({ kind: "gradient", preset: "mist" });
    flushPendingRecentWallpaper({ kind: "solid", colour: "#a2cbbb" });
    expect(loadRecentWallpapers()).toHaveLength(0);

    queueRecentWallpaperOnSave({ kind: "gradient", preset: "mist" });
    flushPendingRecentWallpaper({ kind: "gradient", preset: "mist" });
    expect(loadRecentWallpapers()[0]?.key).toBe("gradient:mist");
  });

  it("identity keys stay stable", () => {
    expect(wallpaperIdentityKey({ kind: "none" })).toBe("none");
    expect(
      wallpaperIdentityKey({
        kind: "image",
        media: { source: "builtin", builtinId: "forest@v1" },
        position: "center",
      }),
    ).toBe("image:builtin:forest@v1");
  });

  it("prunes asset entries and hides them when absent from the library", () => {
    const asset = { source: "asset" as const, assetId: "hulk1" };
    recordRecentWallpaper({
      kind: "image",
      media: asset,
      position: "center",
    });
    recordRecentWallpaper({ kind: "gradient", preset: "ocean" });
    expect(loadRecentWallpapers()).toHaveLength(2);
    expect(loadRecentWallpapers([])).toHaveLength(1);
    expect(loadRecentWallpapers([])[0]?.key).toBe("gradient:ocean");
    expect(loadRecentWallpapers([asset]).map((e) => e.key)).toEqual([
      "gradient:ocean",
      "image:asset:hulk1",
    ]);

    pruneRecentMediaRef(asset);
    expect(loadRecentWallpapers([asset]).map((e) => e.key)).toEqual([
      "gradient:ocean",
    ]);
  });
});
