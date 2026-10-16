/** @vitest-environment jsdom */
import { afterEach, expect, it } from "vitest";
import { defaultBackground, type Wallpaper } from "./appearance";
import { RECENT_WALLPAPER_KEY, flushPendingRecentWallpaper, loadRecentWallpapers, pruneRecentMediaRef, queueRecentWallpaperOnSave, recordRecentWallpaper, selectRecentWallpaper } from "./wallpaperRecent";
const photo = (id: string): Wallpaper => ({ kind: "image", media: { source: "asset", assetId: id }, position: "center" });
afterEach(() => { localStorage.clear(); queueRecentWallpaperOnSave(undefined); });
it("moves selections to the front without duplicates and caps at eight", () => {
  let entries = selectRecentWallpaper([], photo("a"));
  for (let i = 0; i < 10; i++) entries = selectRecentWallpaper(entries, photo(`p${i}`));
  entries = selectRecentWallpaper(entries, photo("p5"));
  expect(entries).toHaveLength(8);
  expect(entries[0].key).toBe("image:asset:p5");
  expect(entries.filter(e => e.key === entries[0].key)).toHaveLength(1);
  expect(loadRecentWallpapers()).toEqual([]);
});
it("excludes colours, gradients and None from new and previously stored history", () => {
  const ignored: Wallpaper[] = [{kind:"none"}, {kind:"solid",colour:"#ffffff"}, {kind:"gradient",preset:"ocean"}];
  for (const w of ignored) expect(selectRecentWallpaper([],w)).toEqual([]);
  localStorage.setItem(RECENT_WALLPAPER_KEY, JSON.stringify(ignored.map((wallpaper,i)=>({key:String(i),wallpaper,label:"old"}))));
  expect(loadRecentWallpapers()).toEqual([]);
});
it("commits the entire history only when the matching background is saved", () => {
  const a = photo("a"), b = photo("b");
  const bg = {...defaultBackground, wallpaper:b, library:[{source:"asset" as const, assetId:"a"},{source:"asset" as const,assetId:"b"}]};
  const entries = selectRecentWallpaper(selectRecentWallpaper([],a),b);
  queueRecentWallpaperOnSave(bg, entries);
  expect(loadRecentWallpapers()).toEqual([]); // Failure/no acknowledgement leaves history unchanged.
  flushPendingRecentWallpaper({...bg, wallpaper:a}); // Older save cannot consume the draft.
  expect(loadRecentWallpapers()).toEqual([]);
  flushPendingRecentWallpaper(bg);
  expect(loadRecentWallpapers().map(e=>e.key)).toEqual(["image:asset:b","image:asset:a"]);
});
it("stores durable poster thumbs for uploaded videos", () => {
  const video: Wallpaper = {
    kind: "video",
    media: { source: "asset", assetId: "clip1" },
    position: "center",
    playback: "loop",
  };
  const entries = selectRecentWallpaper([], video);
  expect(entries[0].thumb).toBe("/media/assets/clip1/poster");
});
it("filters deleted uploads at save and retains built-ins", () => {
  const builtin: Wallpaper = {kind:"video",media:{source:"builtin",builtinId:"neon-wave@v1"},position:"center",playback:"loop"};
  const entries = selectRecentWallpaper(selectRecentWallpaper([],photo("gone")),builtin);
  const bg = {...defaultBackground, wallpaper:builtin, library:[]};
  queueRecentWallpaperOnSave(bg,entries);
  flushPendingRecentWallpaper(bg);
  expect(loadRecentWallpapers().map(e=>e.key)).toEqual(["video:builtin:neon-wave@v1"]);
});
it("filters missing files and malformed history", () => {
  recordRecentWallpaper(photo("gone"));
  expect(loadRecentWallpapers([])).toEqual([]);
  pruneRecentMediaRef({source:"asset",assetId:"gone"});
  expect(loadRecentWallpapers()).toEqual([]);
  localStorage.setItem(RECENT_WALLPAPER_KEY, JSON.stringify([{key:"broken"}]));
  expect(loadRecentWallpapers()).toEqual([]);
});
