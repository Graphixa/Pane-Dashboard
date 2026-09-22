import { useEffect, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
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
}: {
  label: string;
  value: string;
  kind: "icon" | "logo" | "background";
  change: (s: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const uploaded = value.startsWith("data:");
  return (
    <div className="image-field">
      <div className="image-actions">
        <button
          type="button"
          className="upload-tile"
          aria-label={`Upload ${label.toLowerCase()}`}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {uploaded ? <Upload size={22} /> : <Plus size={24} />}
          <span>
            {busy ? "Preparing…" : uploaded ? "Replace upload" : "Upload image"}
          </span>
        </button>
        <input
          ref={input}
          className="file-picker"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={`${label} file`}
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!f) return;
            setError("");
            setBusy(true);
            onBusy(true);
            try {
              const url = await prepareUpload(f, kind);
              if (alive.current) change(url);
            } catch (err) {
              if (alive.current) setError((err as Error).message);
            } finally {
              if (alive.current) {
                setBusy(false);
                onBusy(false);
              }
            }
          }}
        />
        <label>
          {label} URL
          <input
            type="url"
            maxLength={2048}
            placeholder="https://example.com/image.png"
            value={uploaded ? "" : value}
            onChange={(e) => {
              setError("");
              change(e.target.value);
            }}
          />
        </label>
      </div>
      {uploaded && (
        <p className="hint">
          Uploaded image included in backups. Enter a URL to replace it.
        </p>
      )}
      {value && (
        <button
          type="button"
          className="text-button"
          onClick={() => change("")}
        >
          Remove {label.toLowerCase()}
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        PNG, JPEG or WebP, up to 8 MiB. Images are resized to fit; uploads never
        stretch.
      </p>
    </div>
  );
}
