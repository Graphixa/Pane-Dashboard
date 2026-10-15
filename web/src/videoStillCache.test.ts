// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  clearVideoStillCache,
  ensureVideoStill,
  peekVideoStill,
  seedVideoStillForTest,
} from "./videoStillCache";

afterEach(() => {
  clearVideoStillCache();
});

describe("videoStillCache", () => {
  it("returns seeded stills without recapturing", async () => {
    seedVideoStillForTest("/media/assets/a", "blob:cached-a");
    expect(peekVideoStill("/media/assets/a")).toBe("blob:cached-a");
    await expect(ensureVideoStill("/media/assets/a")).resolves.toBe("blob:cached-a");
  });
});
