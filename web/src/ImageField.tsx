import { Button, Input, Label, Notice } from "./design/components";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { logoReference } from "./appearance";
import { prepareUpload } from "./services/media";

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
