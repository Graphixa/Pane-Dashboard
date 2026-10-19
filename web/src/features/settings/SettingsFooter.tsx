import type { ReactNode } from "react";
import { Button } from "../../design/components";

/** Presents Apply/Cancel status; does not own a second save queue. */
export function SettingsFooter({
  status,
  saving,
  applyDisabled,
  onCancel,
}: {
  status: ReactNode;
  saving: boolean;
  applyDisabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="settings-footer">
      <div
        className="settings-status"
        aria-live="polite"
        aria-busy={saving || undefined}
      >
        {status}
      </div>
      <div className="ui-actions settings-footer-actions">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="settings-form"
          variant="primary"
          busy={saving}
          disabled={applyDisabled}
        >
          {saving ? "Saving…" : "Apply settings"}
        </Button>
      </div>
    </div>
  );
}
