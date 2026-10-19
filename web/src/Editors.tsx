import { useRef, useState } from "react";
import { stringify } from "yaml";
import { AppIconPicker } from "./AppIconPicker";
import {
  Button,
  Disclosure,
  Modal,
  Notice,
  SelectField,
  SelectOption,
  SwitchRow,
  Text,
  TextField,
  useConfirmation,
} from "./design/components";
import { applyCatalogueTileSelection } from "./icons";
import { App, Config, Pane, clone, moveApp, uid, validate } from "./model";

export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([stringify(value)], { type: "application/yaml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

  const destinationPane = config.items.find((p) => p.id === destination);
  const placementSummary = `${destinationPane?.title || "Untitled pane"} · column ${draft.col + 1}, row ${draft.row + 1}`;

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
          onSelect={(entry) =>
            setDraft((prev) => applyCatalogueTileSelection(prev, entry))
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
          <Text as="p" variant="support" className="ui-app-placement-summary">
            {placementSummary}
          </Text>
          <div className="fields">
            <SelectField
              label="Pane"
              value={destination}
              onValueChange={(value) => setDestination(value)}
            >
              {config.items.map((p) => (
                <SelectOption key={p.id} value={p.id}>
                  {p.title || "Untitled pane"}
                </SelectOption>
              ))}
            </SelectField>
            <TextField
              label="Column (1-based)"
              type="number"
              min={1}
              required
              value={draft.col + 1}
              onChange={(e) =>
                setDraft({ ...draft, col: Number(e.target.value) - 1 })
              }
            />
            <TextField
              label="Row (1-based)"
              type="number"
              min={1}
              required
              value={draft.row + 1}
              onChange={(e) =>
                setDraft({ ...draft, row: Number(e.target.value) - 1 })
              }
            />
          </div>
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

export function PaneEditor({
  config,
  pane,
  apply,
  close,
}: {
  config: Config;
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
            const n = clone(config);
            n.items = n.items.map((p) => (p.id === pane.id ? draft : p));
            validate(n);
            apply(n);
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
              const p = clone(draft);
              p.apps.forEach((a) => {
                a.url = "";
                delete a.source;
              });
              download("pane-template.yaml", {
                type: "pane-layout",
                version: 3,
                pane: p,
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
                  description: `Delete this pane and its ${pane.apps.length} apps? This cannot be undone.`,
                  cancelLabel: "Cancel",
                  actionLabel: "Delete pane",
                })
              ) {
                apply({
                  ...config,
                  items: config.items.filter((p) => p.id !== pane.id),
                });
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
