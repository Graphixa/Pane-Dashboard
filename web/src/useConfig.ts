import { useCallback, useEffect, useRef, useState } from "react";
import { Config, validate } from "./model";

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
    alive = useRef(true);
  const onSavedRef = useRef(options?.onSaved);
  onSavedRef.current = options?.onSaved;

  const save = useCallback(async () => {
    if (
      busy.current ||
      blocked.current ||
      !current.current ||
      JSON.stringify(current.current) === saved.current
    )
      return;
    busy.current = true;
    const body = JSON.stringify(current.current);
    const snapshot = current.current;
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
    } catch (e) {
      setStatus(blocked.current ? "Conflict" : "Not saved");
      setError(String((e as Error).message));
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
        const c: unknown = await res.json();
        validate(c);
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
  const change = (next: Config) => {
    if (blocked.current)
      throw Error(
        "Reload to resolve the save conflict before making further changes.",
      );
    validate(next);
    current.current = next;
    setConfig(next);
    setStatus("Unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 450);
  };
  return { config, change, status, error, retry: save };
}
