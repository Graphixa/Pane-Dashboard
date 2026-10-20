// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CatalogueIconImg } from "./CatalogueIconImg";
import { resetCatalogueCacheForTests } from "./appCatalogue";

describe("CatalogueIconImg", () => {
  it("retries the alternate format once before exhausting", async () => {
    resetCatalogueCacheForTests();
    const onExhausted = vi.fn();
    const { container } = render(
      <CatalogueIconImg
        icon="dashboard-icons:plex"
        onExhausted={onExhausted}
      />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("/svg/plex.svg");

    fireEvent.error(img);
    expect(onExhausted).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(img.getAttribute("src")).toContain("/png/plex.png"),
    );

    fireEvent.error(img);
    await waitFor(() => expect(onExhausted).toHaveBeenCalledTimes(1));
  });
});
