import { useRef, useState } from "react";
import {
  Button,
  ImagePopoverActions,
  Input,
  Label,
  Notice,
  Popover,
  PopoverHead,
} from "../../../design/components";
import { logoReference } from "../../../appearance";

/** URL-only popover for Custom logo; file upload uses the inline drop target. */
export function BrandUrlPicker({
  value,
  onLive,
}: {
  value: string;
  onLive: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const revert = useRef(value);
  const keepDraft = useRef(false);
  const uploaded =
    value.startsWith("/media/assets/") || value.startsWith("/media/staging/");
  const cancel = () => {
    keepDraft.current = false;
    onLive(revert.current);
    setOpen(false);
  };
  const confirm = () => {
    keepDraft.current = true;
    setOpen(false);
  };
  return (
    <Popover
      label="Paste logo URL"
      size="image"
      open={open}
      onOpenChange={(next) => {
        if (next) {
          keepDraft.current = false;
          revert.current = value;
          setOpen(true);
          return;
        }
        if (!keepDraft.current) onLive(revert.current);
        keepDraft.current = false;
        setOpen(false);
      }}
      trigger={
        <Button type="button" variant="quiet" className="settings-row-action">
          From URL
        </Button>
      }
    >
      <PopoverHead
        title="Custom logo"
        closeLabel="Close custom logo URL picker"
        onClose={cancel}
      />
      <Label className="image-url-field">
        <span>From URL</span>
        <Input
          type="url"
          maxLength={2048}
          placeholder="https://example.com/image.png"
          aria-label="Logo image URL"
          value={uploaded ? "" : value}
          onChange={(e) => onLive(e.target.value)}
        />
      </Label>
      {value && !logoReference(value) && !uploaded ? (
        <Notice tone="error">Enter a valid HTTP(S) image URL.</Notice>
      ) : null}
      <p className="hint">
        Remote URLs stay as links; file drops on the preview become local media assets.
      </p>
      <ImagePopoverActions cancel={cancel} confirm={confirm} />
    </Popover>
  );
}
