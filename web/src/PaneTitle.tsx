import { Input, Button } from "./design/components";
import { useState } from "react";

export default function PaneTitle({
  title,
  editable,
  save,
}: {
  title: string;
  editable: boolean;
  save: (title: string) => void;
}) {
  const [active, setActive] = useState(false),
    [draft, setDraft] = useState(title);
  if (!editable) return title ? <h2 className="pane-title">{title}</h2> : null;
  if (active)
    return (
      <Input
        className="pane-title-input pane-controls"
        autoFocus
        aria-label="Pane title"
        maxLength={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          save(draft);
          setActive(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setActive(false);
          }
        }}
      />
    );
  return (
    <Button variant="surface"
      className="pane-title pane-controls"
      title="Edit pane title"
      aria-label={`Edit title: ${title || "Untitled pane"}`}
      onClick={() => {
        setDraft(title);
        setActive(true);
      }}
    >
      {title || "Add title"}
    </Button>
  );
}

