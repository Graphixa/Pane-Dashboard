import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button, Input, Notice } from "../../../design/components";
import { logoReference } from "../../../appearance";
import {
  inlineBuiltinIconIds,
  resolveBuiltinIcon,
  type BuiltinIconId,
} from "../../../brandIcons";
import { prepareUpload } from "../../../services/media";

/** Inline 2×6 builtins with a square custom-upload drop matching the grid height. */
export function IconBrandControl({
  builtinIcon,
  icon,
  onBuiltin,
  onCustom,
  onBusy,
}: {
  builtinIcon?: BuiltinIconId;
  icon: string;
  onBuiltin: (id: BuiltinIconId) => void;
  onCustom: (path: string) => void;
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
  useEffect(() => setFailed(false), [icon]);
  const take = async (file: File) => {
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const committed = await prepareUpload(file, "icon");
      onCustom(committed.path);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  const url = logoReference(icon) && icon ? icon : undefined;
  const showArt = Boolean(url && !failed);
  const selectedBuiltin = !icon ? (builtinIcon ?? "grid") : undefined;
  return (
    <div className="icon-brand-control">
      <div className="icon-brand-main">
        <div
          className="icon-picker-grid icon-picker-grid--inline"
          role="group"
          aria-label="Built-in icons"
        >
          {inlineBuiltinIconIds.map((id) => {
            const Icon = resolveBuiltinIcon(id);
            return (
              <Button
                key={id}
                type="button"
                variant="surface"
                className="icon-picker-tile"
                aria-label={id}
                aria-pressed={selectedBuiltin === id}
                onClick={() => onBuiltin(id)}
              >
                <Icon size={18} aria-hidden="true" />
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="surface"
          className="icon-custom-square"
          data-drag={drag ? "true" : undefined}
          data-filled={showArt ? "true" : undefined}
          aria-label={
            busy
              ? "Uploading custom icon"
              : showArt
                ? "Replace custom icon"
                : "Upload custom icon"
          }
          aria-pressed={showArt}
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
            <span className="icon-custom-square-label">Uploading…</span>
          ) : showArt ? (
            <img
              className="icon-custom-square-preview"
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          ) : (
            <>
              <Upload size={20} aria-hidden="true" />
              <span className="icon-custom-square-label">Your own</span>
            </>
          )}
        </Button>
      </div>
      <Input
        ref={input}
        className="file-picker"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Custom icon file"
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
