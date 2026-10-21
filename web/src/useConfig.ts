import { useCallback, useEffect, useRef, useState } from "react";
import { Config, parseConfig, validate } from "./model";

export type SaveOutcome =
  | { status: "saved"; config: Config }
  | { status: "failed"; error: string }
  | { status: "conflict"; error: string };

export type ConfigChange = Config | ((current: Config) => Config);

type Waiter = {
  body: string;
  resolve: (outcome: SaveOutcome) => void;
};

export function useConfig(options?: {
  /** Fires after a successful revision-protected PUT (not on load). */
  onSaved?: (config: Config) => void;
}) {
  const [config, setConfig] = useState<Config | null>(null),
    [status, setStatus] = useState("Loading"),
    [error, setError] = useState("");
  const revision = useRef(""),
    current = useRef<Config | null>(null),
    saved = useRef(""),
    busy = useRef(false),
    blocked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true),
    waiters = useRef<Waiter[]>([]);
  const onSavedRef = useRef(options?.onSaved);
  onSavedRef.current = options?.onSaved;

  const settleWaiters = (body: string, outcome: SaveOutcome) => {
    const rest: Waiter[] = [];
    for (const waiter of waiters.current) {
      if (waiter.body === body) waiter.resolve(outcome);
      else rest.push(waiter);
    }
    waiters.current = rest;
  };

  const rejectWaiters = (predicate: (body: string) => boolean, outcome: SaveOutcome) => {
    const rest: Waiter[] = [];
    for (const waiter of waiters.current) {
      if (predicate(waiter.body)) waiter.resolve(outcome);
      else rest.push(waiter);
    }
    waiters.current = rest;
  };

  const save = useCallback(async () => {
    if (busy.current || blocked.current || !current.current) return;
    const snapshot = current.current;
    const body = JSON.stringify(snapshot);
    // No-op PUT: still notify so Settings Apply can flush Recently used when
    // the draft already matched the saved config.
    if (body === saved.current) {
      setStatus("Saved");
      setError("");
      onSavedRef.current?.(snapshot);
      settleWaiters(body, { status: "saved", config: snapshot });
      return;
    }
    busy.current = true;
    setStatus("Saving");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": revision.current,
        },
        body,
      });
      if (!res.ok) {
        if (res.status === 412) blocked.current = true;
        throw Error((await res.json()).error || "Save failed");
      }
      revision.current = res.headers.get("ETag") || "";
      saved.current = body;
      setStatus("Saved");
      setError("");
      onSavedRef.current?.(snapshot);
      settleWaiters(body, { status: "saved", config: snapshot });
    } catch (e) {
      const message = String((e as Error).message);
      setStatus(blocked.current ? "Conflict" : "Not saved");
      setError(message);
      settleWaiters(
        body,
        blocked.current
          ? { status: "conflict", error: message }
          : { status: "failed", error: message },
      );
    } finally {
      busy.current = false;
      if (
        alive.current &&
        !blocked.current &&
        saved.current === body &&
        JSON.stringify(current.current) !== body
      )
        timer.current = setTimeout(save, 100);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw Error("Could not load configuration");
        const raw: unknown = await res.json();
        const c = parseConfig(raw);
        revision.current = res.headers.get("ETag") || "";
        current.current = c;
        saved.current = JSON.stringify(c);
        setConfig(c);
        setStatus("Saved");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setStatus("Load failed");
        }
      });
    return () => {
      alive.current = false;
      controller.abort();
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (
        JSON.stringify(current.current) !== saved.current &&
        current.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);

  const change = (update: ConfigChange) => {
    if (blocked.current)
      throw Error(
        "Reload to resolve the save conflict before making further changes.",
      );
    if (!current.current) throw Error("Configuration is still loading.");
    const next = typeof update === "function" ? update(current.current) : update;
    validate(next);
    current.current = next;
    setConfig(next);
    setStatus("Unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 450);
  };

  /**
   * Merge settings-owned fields onto the latest config and persist through the
   * serialised queue. Resolves only when this exact snapshot is acknowledged,
   * fails, or conflicts — not when an older queued save completes.
   */
  const commitSettings = (settings: {
    dashboard: Config["dashboard"];
    appearance: Config["appearance"];
  }): Promise<SaveOutcome> => {
    if (!current.current) {
      return Promise.resolve({
        status: "failed",
        error: "Configuration is still loading.",
      });
    }
    if (blocked.current) {
      return Promise.resolve({
        status: "conflict",
        error:
          "Configuration changed elsewhere. Reload before saving settings.",
      });
    }
    const next: Config = {
      ...current.current,
      dashboard: settings.dashboard,
      appearance: settings.appearance,
    };
    validate(next);
    current.current = next;
    setConfig(next);
    setStatus("Unsaved");
    clearTimeout(timer.current);
    const body = JSON.stringify(next);
    return new Promise((resolve) => {
      waiters.current.push({ body, resolve });
      void save();
    });
  };

  /**
   * After discarding a failed Settings draft: restore last acknowledged
   * dashboard/appearance, keep current spaces/catalogue, and drop abandoned waiters.
   */
  const discardSettings = () => {
    if (!current.current || !saved.current) return;
    const acknowledged = JSON.parse(saved.current) as Config;
    const abandoned = JSON.stringify(current.current);
    const restored: Config = {
      ...acknowledged,
      spaces: current.current.spaces,
      apps: current.current.apps,
      dashboardId: current.current.dashboardId,
      defaultSpaceId: current.current.defaultSpaceId,
    };
    rejectWaiters(
      (body) => body === abandoned,
      {
        status: "failed",
        error: "Settings changes were discarded.",
      },
    );
    current.current = restored;
    setConfig(restored);
    clearTimeout(timer.current);
    if (JSON.stringify(restored) !== saved.current) {
      setStatus("Unsaved");
      timer.current = setTimeout(save, 450);
    } else {
      setStatus("Saved");
      setError((prev) => (blocked.current ? prev : ""));
    }
  };

  return {
    config,
    change,
    commitSettings,
    discardSettings,
    status,
    error,
    retry: save,
  };
}
