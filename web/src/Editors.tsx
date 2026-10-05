import { useConfirmation } from "./design/components";
import { Label, Checkbox, Input, Select, SelectOption } from "./design/components";
import { useState } from "react";
import { stringify } from "yaml";
import { App, Config, Pane, clone, moveApp, uid, validate } from "./model";
import { catalogue, iconURL } from "./icons";
import { Modal } from "./design/components";
import { Button, TextField } from "./design/components";
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
const [draft, setDraft] = useState<App>(
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
    ),
    [destination, setDestination] = useState(paneId),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
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
    <Modal title={app ? "Edit app" : "Add app"} close={close}>
      {confirmation}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField label="Name"
            required
            maxLength={100}
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        <TextField label="Address"
            hint="Leave blank for a template. Only HTTP(S) addresses are supported."
            placeholder="https://service.example.com"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
        <Label className="check">
          <Checkbox
            checked={draft.openInNewTab}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, openInNewTab: checked })
            }
          />
          Open in a new tab
        </Label>
        <Label>
          Icon reference or custom URL
          <Input
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            placeholder="dashboard-icons:plex"
          />
        </Label>
        <Label>
          Search icons
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the local catalogue"
          />
        </Label>
        <div className="icon-picker">
          {catalogue
            .filter((s) => s.includes(search.toLowerCase()))
            .slice(0, 24)
            .map((s) => (
              <Button variant="surface"
                type="button"
                key={s}
                title={s}
                className={
                  draft.icon === `dashboard-icons:${s}` ? "selected" : ""
                }
                onClick={() =>
                  setDraft({ ...draft, icon: `dashboard-icons:${s}` })
                }
              >
                <img
                  loading="lazy"
                  src={iconURL(`dashboard-icons:${s}`)}
                  alt=""
                />
                <span>{s}</span>
              </Button>
            ))}
        </div>
        <div className="fields">
          <Label>
            Pane
            <Select
              value={destination}
              onValueChange={(value) => setDestination(value)}
            >
              {config.items.map((p) => (
                <SelectOption key={p.id} value={p.id}>
                  {p.title || "Untitled pane"}
                </SelectOption>
              ))}
            </Select>
          </Label>
          <Label>
            Column (1-based)
            <Input
              type="number"
              min={1}
              required
              value={draft.col + 1}
              onChange={(e) =>
                setDraft({ ...draft, col: Number(e.target.value) - 1 })
              }
            />
          </Label>
          <Label>
            Row (1-based)
            <Input
              type="number"
              min={1}
              required
              value={draft.row + 1}
              onChange={(e) =>
                setDraft({ ...draft, row: Number(e.target.value) - 1 })
              }
            />
          </Label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          {app && (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (await confirm({
                  title: "Delete app?",
                  description: `Delete ${app.name}? This removes it from the pane and cannot be undone.`,
                  cancelLabel: "Cancel",
                  actionLabel: "Delete app",
                })) {
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
          )}
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save app
          </Button>
        </div>
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
        <Label>
          Title (optional)
          <Input
            autoFocus
            maxLength={100}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Label>
        <p className="hint">
          Resize in whole app slots. Occupied slots and neighbouring panes are
          protected.
        </p>
        <div className="fields">
          {(["w", "h"] as const).map((k) => (
            <Label key={k}>
              {{ w: "Columns", h: "Rows" }[k]}
              <Input
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
            </Label>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
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
                version: 2,
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
              if (await confirm({
                title: "Delete pane?",
                description: `Delete this pane and its ${pane.apps.length} apps? This cannot be undone.`,
                cancelLabel: "Cancel",
                actionLabel: "Delete pane",
              })) {
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
