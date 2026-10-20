import { useRef, useState } from "react";
import { AppIconPicker } from "./AppIconPicker";
import { AppPlacementFields } from "./AppPlacementFields";
import {
  Button,
  Disclosure,
  Modal,
  Notice,
  SwitchRow,
  TextField,
  useConfirmation,
} from "../../design/components";
import { applyCatalogueTileSelection } from "./appCatalogue";
import { App, Config, clone, moveApp, uid, validate } from "../../model";

const APP_DETAILS_NAME_ID = "app-editor-name";

export function AppEditor({
  config,
  paneId,
  app,
  col,
  row,
  apply,
  close,
}: {
  config: Config;
  paneId: string;
  app?: App;
  col: number;
  row: number;
  apply: (c: Config) => void;
  close: () => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const initialDraft = useRef<App>(
    app
      ? clone(app)
      : {
          id: uid(),
          name: "",
          url: "",
          icon: "",
          col,
          row,
          openInNewTab: true,
        },
  );
  const initialDestination = useRef(paneId);
  const [draft, setDraft] = useState<App>(() => clone(initialDraft.current));
  const [destination, setDestination] = useState(paneId);
  const [error, setError] = useState("");
  const formId = "app-editor-form";

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft.current) ||
    destination !== initialDestination.current;

  const requestClose = async () => {
    if (
      !dirty ||
      (await confirm({
        title: "Discard changes?",
        description: "Discard unsaved app changes?",
        cancelLabel: "Keep editing",
        actionLabel: "Discard",
      }))
    ) {
      close();
    }
  };

  const save = () => {
    try {
      let n = clone(config);
      if (app) {
        n.items.find((p) => p.id === paneId)!.apps = n.items
          .find((p) => p.id === paneId)!
          .apps.map((a) =>
            a.id === app.id ? { ...draft, col: app.col, row: app.row } : a,
          );
        n = moveApp(n, app.id, destination, draft.col, draft.row);
      } else n.items.find((p) => p.id === destination)!.apps.push(draft);
      validate(n);
      apply(n);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal
      title={app ? "Edit app" : "Add app"}
      close={requestClose}
      footer={
        <div className="ui-actions">
          <Button type="button" onClick={() => void requestClose()}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            {app ? "Save changes" : "Add app"}
          </Button>
        </div>
      }
    >
      {confirmation}
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AppIconPicker
          selectedIcon={draft.icon}
          detailsTargetId={APP_DETAILS_NAME_ID}
          autoFocusSearch={!app}
          onSelect={({ entry, artworkSlug }) =>
            setDraft((prev) =>
              applyCatalogueTileSelection(prev, entry, artworkSlug),
            )
          }
        />
        <TextField
          id={APP_DETAILS_NAME_ID}
          label="Name"
          required
          maxLength={100}
          autoFocus={Boolean(app)}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <TextField
          label="Address"
          hint="Leave blank for a template. Only HTTP(S) addresses are supported."
          placeholder="https://service.example.com"
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
        <SwitchRow
          label="Open in a new tab"
          checked={draft.openInNewTab}
          onCheckedChange={(checked) =>
            setDraft({ ...draft, openInNewTab: checked })
          }
        />
        <Disclosure title="Custom icon">
          <TextField
            label="Icon reference or custom URL"
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            placeholder="dashboard-icons:plex"
          />
        </Disclosure>
        <Disclosure title="Placement">
          <AppPlacementFields
            config={config}
            destination={destination}
            col={draft.col}
            row={draft.row}
            onDestinationChange={setDestination}
            onColChange={(nextCol) => setDraft({ ...draft, col: nextCol })}
            onRowChange={(nextRow) => setDraft({ ...draft, row: nextRow })}
          />
        </Disclosure>
        {error && <Notice tone="error">{error}</Notice>}
        {app && (
          <div className="ui-app-editor-danger">
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete app?",
                    description: `Delete ${app.name}? This removes it from the pane and cannot be undone.`,
                    cancelLabel: "Cancel",
                    actionLabel: "Delete app",
                  })
                ) {
                  const n = clone(config);
                  n.items.find((p) => p.id === paneId)!.apps = n.items
                    .find((p) => p.id === paneId)!
                    .apps.filter((a) => a.id !== app.id);
                  apply(n);
                  close();
                }
              }}
            >
              Delete app
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
