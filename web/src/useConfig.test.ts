// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConfig } from "./useConfig";
import type { Config } from "./model";

const base = (): Config => ({
  version: 3,
  dashboard: { title: "Pane", widthMode: "fixed", width: 960 },
  appearance: { theme: "dark", showAppLabels: true, showButtonLabels: true },
  items: [],
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useConfig settings transactions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves commitSettings only for the matching snapshot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const initial = base();
    let putCount = 0;
    const slow = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return new Response(JSON.stringify(initial), {
            status: 200,
            headers: { ETag: '"r1"', "Content-Type": "application/json" },
          });
        }
        putCount += 1;
        if (putCount === 1) return slow.promise;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ETag: '"r2"', "Content-Type": "application/json" },
        });
      }),
    );

    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.config).toBeTruthy());

    // Queue an autosave that will complete later.
    act(() => {
      result.current.change({
        ...initial,
        items: [
          {
            id: "pane1",
            type: "pane",
            title: "Media",
            layout: { x: 0, y: 0, w: 4, h: 1 },
            apps: [],
          },
        ],
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    const settingsPromise = result.current.commitSettings({
      dashboard: { ...initial.dashboard, title: "Settings title" },
      appearance: initial.appearance,
    });

    // Completing the older autosave must not settle the settings promise.
    let settled = false;
    void settingsPromise.then(() => {
      settled = true;
    });
    await act(async () => {
      slow.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ETag: '"r1b"', "Content-Type": "application/json" },
        }),
      );
      await Promise.resolve();
    });
    expect(settled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const outcome = await settingsPromise;
    expect(outcome.status).toBe("saved");
    if (outcome.status === "saved") {
      expect(outcome.config.dashboard.title).toBe("Settings title");
      expect(outcome.config.items).toHaveLength(1);
    }
  });

  it("discardSettings restores acknowledged settings and drops abandoned waiters", async () => {
    const initial = base();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return new Response(JSON.stringify(initial), {
            status: 200,
            headers: { ETag: '"r1"', "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "server down" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.config).toBeTruthy());

    let outcome!: Awaited<ReturnType<typeof result.current.commitSettings>>;
    await act(async () => {
      outcome = await result.current.commitSettings({
        dashboard: { ...initial.dashboard, title: "Abandoned" },
        appearance: initial.appearance,
      });
    });
    expect(outcome.status).toBe("failed");
    expect(result.current.config?.dashboard.title).toBe("Abandoned");

    act(() => {
      result.current.discardSettings();
    });
    expect(result.current.config?.dashboard.title).toBe("Pane");

    // Global retry must not resurrect the abandoned title.
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.config?.dashboard.title).toBe("Pane");
  });

  it("reports conflict on HTTP 412 without forcing overwrite", async () => {
    const initial = base();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return new Response(JSON.stringify(initial), {
            status: 200,
            headers: { ETag: '"r1"', "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Revision conflict" }), {
          status: 412,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.config).toBeTruthy());

    let outcome!: Awaited<ReturnType<typeof result.current.commitSettings>>;
    await act(async () => {
      outcome = await result.current.commitSettings({
        dashboard: { ...initial.dashboard, title: "Conflicted" },
        appearance: initial.appearance,
      });
    });
    expect(outcome).toEqual({
      status: "conflict",
      error: "Revision conflict",
    });
    expect(result.current.status).toBe("Conflict");
  });
});
