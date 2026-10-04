import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { imageReference } from "./appearance";

export async function prepareUpload(
  file: File,
  kind: "icon" | "logo" | "background",
): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG or WebP image up to 8 MiB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20_000_000)
      throw Error("Choose an image smaller than 20 million pixels.");
    const maxW = kind === "icon" ? 512 : kind === "logo" ? 1200 : 1920,
      maxH = kind === "icon" ? 512 : kind === "logo" ? 320 : 1920;
    const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Image preparation is unavailable in this browser.");
    if (kind === "background") {
      ctx.fillStyle = "#111720";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Could not prepare image."))),
        kind === "background" ? "image/jpeg" : "image/png",
        0.86,
      ),
    );
    const res = await fetch("/api/images/prepare", {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    const body = await res.json();
    if (!res.ok) throw Error(body.error || "Upload could not be prepared.");
    if (!imageReference(body.image) || !body.image.startsWith("data:"))
      throw Error("Invalid image response.");
    return body.image;
  } finally {
    bitmap.close();
  }
}
export default function ImageField({
  label,
  value,
  kind,
  change,
  onBusy,
  hint,
}: {
  label: string;
  value: string;
  kind: "icon" | "logo" | "background";
  change: (s: string) => void;
  onBusy: (busy: boolean) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const uploaded = value.startsWith("data:");
  const formats = hint ?? "PNG, JPEG or WebP, up to 8 MiB.";
  const take = async (file: File) => {
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const url = await prepareUpload(file, kind);
      if (alive.current) change(url);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };
  return (
    <div className="image-field">
      <button
        type="button"
        className="image-dropzone"
        data-drag={drag ? "true" : undefined}
        aria-label={`Upload ${label.toLowerCase()}`}
        disabled={busy}
        onClick={() => input.current?.click()}
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
            ? "Preparing…"
            : uploaded
              ? "Drop to replace, or click to browse"
              : "Drop an image here, or click to browse"}
        </span>
        <span className="image-dropzone-hint">{formats}</span>
      </button>
      <input
        ref={input}
        className="file-picker"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`${label} file`}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void take(file);
        }}
      />
      <div className="image-or" aria-hidden="true">
        or
      </div>
      <label className="image-url-field">
        <span>From URL</span>
        <input
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
      </label>
      <div className="image-field-meta">
        {value ? (
          <button
            type="button"
            className="text-button"
            onClick={() => change("")}
          >
            Remove
          </button>
        ) : null}
        <p className="hint">
          {uploaded
            ? "Uploaded image is included in backups."
            : "Remote URLs stay as links; uploads are embedded in backups."}
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
