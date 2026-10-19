import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button, Input, Notice } from "../../../design/components";
import { logoReference } from "../../../appearance";
import { prepareUpload } from "../../../services/media";

/** ImageField-style dropzone in the Custom logo control column. */
export function LogoDropTarget({
  logo,
  onLive,
  onBusy,
}: {
  logo: string;
  onLive: (logo: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => setFailed(false), [logo]);
  const take = async (file: File) => {
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const committed = await prepareUpload(file, "logo");
      onLive(committed.path);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  const url = logoReference(logo) && logo ? logo : undefined;
  const showArt = Boolean(url && !failed);
  return (
    <div className="logo-drop-field">
      <Button
        type="button"
        variant="surface"
        className="image-dropzone logo-drop-target"
        data-drag={drag ? "true" : undefined}
        aria-label={logo ? "Replace custom logo" : "Upload custom logo"}
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
        {busy ? (
          <span className="image-dropzone-title">Uploading…</span>
        ) : showArt ? (
          <>
            <img
              className="logo-drop-preview"
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
            <span className="image-dropzone-title">
              Drop to replace, or click to browse
            </span>
            <span className="image-dropzone-hint">
              PNG, JPEG or WebP, up to 8 MiB.
            </span>
          </>
        ) : (
          <>
            <Upload size={28} aria-hidden="true" />
            <span className="image-dropzone-title">
              Drop an image here, or click to browse
            </span>
            <span className="image-dropzone-hint">
              PNG, JPEG or WebP, up to 8 MiB.
            </span>
          </>
        )}
      </Button>
      <Input
        ref={input}
        className="file-picker"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Custom logo file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void take(file);
        }}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
