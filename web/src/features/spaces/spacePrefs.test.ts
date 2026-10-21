import { describe, expect, it } from "vitest";
import { resolveActiveSpace } from "./spacePrefs";

describe("resolveActiveSpace", () => {
  const spaces = [{ id: "home" }, { id: "work" }];
  it("prefers a valid remembered id", () => {
    expect(resolveActiveSpace(spaces, "work", "home")).toBe("work");
  });
  it("falls back to default then first", () => {
    expect(resolveActiveSpace(spaces, "missing", "home")).toBe("home");
    expect(resolveActiveSpace(spaces, null, "missing")).toBe("home");
  });
});
