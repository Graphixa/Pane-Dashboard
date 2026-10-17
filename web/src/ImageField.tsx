import { Button, Input, Label, Notice } from "./design/components";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { logoReference } from "./appearance";
import {
  assetIdFromMediaPath,
  extractVideoStillFromFile,
  putVideoPoster,
  seedVideoStillFromBlob,
} from "./videoStillCache";

export type StagedMedia = {
  sessionId: string;
  previewUrl: string;
  kind: "image" | "video";
  meta: {
    mime: string;
    width: number;
    height: number;
    name: string;
    bytes: number;
  };
};

/** Upload original bytes to staging. Preserves format; no JPEG conversion. */
export async function stageMediaUpload(file: File): Promise<StagedMedia> {
  const isVideo = file.type.startsWith("video/");
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  if (!isImage && !isVideo)
    throw Error("Choose a PNG, JPEG, WebP, WebM or MP4 file.");
  const limit = isVideo ? 40 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > limit)
    throw Error(
      isVideo
        ? "Choose a video up to 40 MiB."
        : "Choose an image up to 12 MiB.",
    );
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Pane-Filename": file.name || "upload",
    },
    body: file,
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Upload failed.");
  if (!body.sessionId || !body.previewUrl || !body.meta)
    throw Error("Invalid upload response.");
  return {
    sessionId: body.sessionId,
    previewUrl: body.previewUrl,
    kind: body.meta.kind,
    meta: body.meta,
  };
}

export type CommittedMedia = {
  path: string;
  name: string;
  kind: "image" | "video";
};

/** Commit staged upload into a durable asset; returns path plus stored display name. */
export async function commitStagedMedia(sessionId: string): Promise<CommittedMedia> {
  const res = await fetch("/api/media/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Could not save media.");
  if (!body.assetId) throw Error("Invalid commit response.");
  const kind: "image" | "video" =
    body.meta?.kind === "video" ? "video" : "image";
  return {
    path: `/media/assets/${body.assetId}`,
    name: typeof body.meta?.name === "string" && body.meta.name
      ? body.meta.name
      : "upload",
    kind,
  };
}

/** Upload and immediately commit so draft config holds durable asset paths. */
export async function prepareUpload(
  file: File,
  _kind: "icon" | "logo" | "background",
): Promise<CommittedMedia> {
  const staged = await stageMediaUpload(file);
  const committed = await commitStagedMedia(staged.sessionId);
  if (committed.kind === "video") {
    try {
      const still = await extractVideoStillFromFile(file);
      const assetId = assetIdFromMediaPath(committed.path);
      if (still && assetId) {
        seedVideoStillFromBlob(committed.path, still);
        await putVideoPoster(assetId, still);
      }
    } catch {
      // Soft-fail: upload already committed; hover backfill can store a poster later.
    }
  }
  return committed;
}

export default function ImageField({
  label,
  value,
  kind,
  change,
  onBusy,
  hint,
  onNativePick,
  onFileCommitted,
}: {
  label: string;
  value: string;
  kind: "icon" | "logo" | "background";
  change: (s: string) => void;
  onBusy: (busy: boolean) => void;
  hint?: string;
  /** True while the OS file dialog is open (or until focus returns after cancel). */
  onNativePick?: (picking: boolean) => void;
  /** After a successful file/drop upload (not URL paste); caller may auto-confirm. */
  onFileCommitted?: (path: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    picking = useRef(false),
    pickFocusTimer = useRef(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (pickFocusTimer.current) window.clearTimeout(pickFocusTimer.current);
    };
  }, []);
  const setPicking = (next: boolean) => {
    picking.current = next;
    onNativePick?.(next);
  };
  const endPicking = () => {
    if (pickFocusTimer.current) {
      window.clearTimeout(pickFocusTimer.current);
      pickFocusTimer.current = 0;
    }
    if (picking.current) setPicking(false);
  };
  const openNativePicker = () => {
    setPicking(true);
    input.current?.click();
    // Cancelled dialogs often fire no change event; clear the latch on focus return.
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      pickFocusTimer.current = window.setTimeout(() => {
        pickFocusTimer.current = 0;
        if (picking.current) setPicking(false);
      }, 300);
    };
    window.addEventListener("focus", onFocus);
  };
  const uploaded =
    value.startsWith("/media/assets/") || value.startsWith("/media/staging/");
  const formats =
    hint ??
    (kind === "background"
      ? "PNG, JPEG, WebP, WebM or MP4."
      : "PNG, JPEG or WebP, up to 12 MiB.");
  const take = async (file: File) => {
    endPicking();
    setError("");
    setBusy(true);
    onBusy(true);
    let committedPath = "";
    try {
      const committed = await prepareUpload(file, kind);
      // Draft is owned by Settings; apply even if this field unmounted mid-flight.
      change(committed.path);
      committedPath = committed.path;
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
    if (committedPath) onFileCommitted?.(committedPath);
  };
  return (
    <div className="image-field">
      <Button
        variant="surface"
        type="button"
        className="image-dropzone"
        data-drag={drag ? "true" : undefined}
        aria-label={`Upload ${label.toLowerCase()}`}
        disabled={busy}
        onClick={() => openNativePicker()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void take(file);
        }}
      >
        <Upload size={28} aria-hidden="true" />
        <span className="image-dropzone-title">
          {busy
            ? "Uploading…"
            : uploaded
              ? "Drop to replace, or click to browse"
              : "Drop an image here, or click to browse"}
        </span>
        <span className="image-dropzone-hint">{formats}</span>
      </Button>
      <Input
        ref={input}
        className="file-picker"
        type="file"
        accept={
          kind === "background"
            ? "image/png,image/jpeg,image/webp,video/webm,video/mp4"
            : "image/png,image/jpeg,image/webp"
        }
        aria-label={`${label} file`}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void take(file);
          else endPicking();
        }}
      />
      <div className="image-or" aria-hidden="true">
        or
      </div>
      <Label className="image-url-field">
        <span>From URL</span>
        <Input
          type="url"
          maxLength={2048}
          placeholder="https://example.com/image.png"
          aria-label={`${label} URL`}
          value={uploaded ? "" : value}
          onChange={(e) => {
            setError("");
            change(e.target.value);
          }}
        />
      </Label>
      <div className="image-field-meta">
        {value ? (
          <Button
            variant="surface"
            type="button"
            className="text-button"
            onClick={() => change("")}
          >
            Remove
          </Button>
        ) : null}
        <p className="hint">
          {uploaded
            ? "Uploaded media is stored beside configuration and included in portable archives."
            : "Remote URLs stay as links; uploads become local media assets."}
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {value && !logoReference(value) && !uploaded && (
        <Notice tone="error">Enter a valid HTTP(S) image URL.</Notice>
      )}
    </div>
  );
}
