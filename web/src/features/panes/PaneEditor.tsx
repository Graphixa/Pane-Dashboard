import { useState } from "react";
import {
  Button,
  Modal,
  Notice,
  TextField,
  useConfirmation,
} from "../../design/components";
import {
  Config,
  Pane,
  clone,
  getAppDefinition,
  updateSpace,
} from "../../model";
import { download } from "../../utils/download";

export function PaneEditor({
  config,
  spaceId,
  pane,
  apply,
  close,
}: {
  config: Config;
  spaceId: string;
  pane: Pane;
  apply: (c: Config) => void;
  close: () => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [draft, setDraft] = useState(clone(pane)),
    [error, setError] = useState("");
  return (
    <Modal title="Edit pane" close={close}>
      {confirmation}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            apply(
              updateSpace(config, spaceId, (space) => ({
                ...space,
                items: space.items.map((p) => (p.id === pane.id ? draft : p)),
              })),
            );
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <TextField
          label="Title (optional)"
          autoFocus
          maxLength={100}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          hint="Resize in whole app slots. Occupied slots and neighbouring panes are protected."
        />
        <div className="fields">
          {(["w", "h"] as const).map((k) => (
            <TextField
              key={k}
              label={{ w: "Columns", h: "Rows" }[k]}
              type="number"
              required
              min={1}
              max={32}
              value={draft.layout[k]}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  layout: { ...draft.layout, [k]: Number(e.target.value) },
                })
              }
            />
          ))}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="ui-actions">
          <Button
            type="button"
            onClick={() => {
              const apps = draft.apps.map((placement) => {
                const def = getAppDefinition(config, placement.appId);
                return {
                  ...def,
                  url: "",
                  source: undefined,
                  id: placement.appId,
                };
              });
              const uniqueDefs = apps.filter(
                (a, i, list) => list.findIndex((x) => x.id === a.id) === i,
              );
              download("pane-template.yaml", {
                type: "pane-layout",
                version: 4,
                pane: {
                  title: draft.title,
                  layout: draft.layout,
                  apps: draft.apps.map((p) => ({
                    appId: p.appId,
                    col: p.col,
                    row: p.row,
                  })),
                },
                apps: uniqueDefs.map(({ id, name, icon, openInNewTab }) => ({
                  id,
                  name,
                  icon,
                  openInNewTab,
                  url: "",
                })),
                width: config.dashboard.width,
              });
            }}
          >
            Export template
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (
                await confirm({
                  title: "Delete pane?",
                  description: `Delete this pane and its ${pane.apps.length} placements? Shared app definitions are kept. This cannot be undone.`,
                  cancelLabel: "Cancel",
                  actionLabel: "Delete pane",
                })
              ) {
                apply(
                  updateSpace(config, spaceId, (space) => ({
                    ...space,
                    items: space.items.filter((p) => p.id !== pane.id),
                  })),
                );
                close();
              }
            }}
          >
            Delete pane
          </Button>
          <Button variant="primary" type="submit">
            Save pane
          </Button>
        </div>
      </form>
    </Modal>
  );
}
