// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import ImageField from "./ImageField";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ImageField", () => {
  it("applies the committed path even if unmounted mid-upload", async () => {
    let finishCommit!: (value: Response) => void;
    const commitGate = new Promise<Response>((resolve) => {
      finishCommit = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/media/upload") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            sessionId: "sess-unmount",
            previewUrl: "/media/staging/sess-unmount",
            meta: {
              kind: "image",
              mime: "image/png",
              width: 40,
              height: 40,
              name: "mark.png",
              bytes: 3,
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/media/commit")) return commitGate;
      return new Response("{}", { status: 404 });
    });
    const change = vi.fn();
    const onBusy = vi.fn();
    const onFileCommitted = vi.fn();
    const { unmount, getByLabelText } = render(
      <ImageField
        label="Logo image"
        kind="logo"
        value=""
        change={change}
        onBusy={onBusy}
        onFileCommitted={onFileCommitted}
      />,
    );
    const file = new File([new Uint8Array([1, 2, 3])], "mark.png", {
      type: "image/png",
    });
    fireEvent.change(getByLabelText("Logo image file"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(onBusy).toHaveBeenCalledWith(true));
    unmount();
    finishCommit(
      new Response(
        JSON.stringify({
          assetId: "logo-unmount-1",
          meta: { kind: "image", name: "mark.png" },
        }),
        { status: 200 },
      ),
    );
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith("/media/assets/logo-unmount-1"),
    );
    expect(onBusy).toHaveBeenCalledWith(false);
    expect(onFileCommitted).toHaveBeenCalledWith("/media/assets/logo-unmount-1");
  });
});
