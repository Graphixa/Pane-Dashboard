import { useRef, useState } from "react";
import { AppIconPicker } from "./AppIconPicker";
import { AppPlacementFields } from "./AppPlacementFields";
import {
  Button,
  Disclosure,
  Modal,
  Notice,
  SwitchRow,
  Text,
  TextField,
  useConfirmation,
} from "../../design/components";
import { applyCatalogueTileSelection } from "./appCatalogue";
import {
  App,
  AppDefinition,
  Config,
  clone,
  moveApp,
  placementCount,
  uid,
  updateSpace,
  validate,
} from "../../model";

const APP_DETAILS_NAME_ID = "app-editor-name";

export function AppEditor({
  config,
  spaceId,
  paneId,
  app,
  col,
  row,
  apply,
  close,
}: {
  config: Config;
  spaceId: string;
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
          placementId: uid(),
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
  const sharedCount = app ? placementCount(config, app.id) : 0;

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

  const definitionFromDraft = (d: App): AppDefinition => ({
    id: d.id,
    name: d.name,
    url: d.url,
    icon: d.icon,
    openInNewTab: d.openInNewTab,
    ...(d.source ? { source: { ...d.source } } : {}),
  });

  const save = () => {
    try {
      let n = clone(config);
      const def = definitionFromDraft(draft);
      if (app) {
        n.apps = n.apps.map((a) => (a.id === app.id ? def : a));
        n = moveApp(n, spaceId, app.placementId, destination, draft.col, draft.row);
      } else {
        if (!n.apps.some((a) => a.id === def.id)) n.apps.push(def);
        n = updateSpace(n, spaceId, (space) => ({
          ...space,
          items: space.items.map((p) =>
            p.id === destination
              ? {
                  ...p,
                  apps: [
                    ...p.apps,
                    {
                      id: draft.placementId,
                      appId: def.id,
                      col: draft.col,
                      row: draft.row,
                    },
                  ],
                }
              : p,
          ),
        }));
      }
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
        <Text as="p" variant="support">
          App details (shared)
        </Text>
        {sharedCount > 1 && (
          <Notice>
            This app appears in {sharedCount} places. Changing name, address or
            icon updates every placement.
          </Notice>
        )}
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
        {!app && config.apps.length > 0 && (
          <Disclosure title="Existing app">
            <Text as="p" variant="support">
              Reuse a shared app definition instead of creating another.
            </Text>
            <div className="reference-actions" style={{ flexWrap: "wrap" }}>
              {config.apps.map((existing) => (
                <Button
                  key={existing.id}
                  type="button"
                  variant="quiet"
                  aria-pressed={draft.id === existing.id}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      id: existing.id,
                      name: existing.name,
                      url: existing.url,
                      icon: existing.icon,
                      openInNewTab: existing.openInNewTab,
                      source: existing.source,
                    }))
                  }
                >
                  {existing.name}
                </Button>
              ))}
            </div>
          </Disclosure>
        )}
        <Disclosure title="Placement">
          <AppPlacementFields
            config={config}
            spaceId={spaceId}
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
                    title: "Remove app?",
                    description: `Remove ${app.name} from this pane? The shared app definition is kept if it is used elsewhere.`,
                    cancelLabel: "Cancel",
                    actionLabel: "Remove placement",
                  })
                ) {
                  apply(
                    updateSpace(config, spaceId, (space) => ({
                      ...space,
                      items: space.items.map((p) =>
                        p.id === paneId
                          ? {
                              ...p,
                              apps: p.apps.filter(
                                (a) => a.id !== app.placementId,
                              ),
                            }
                          : p,
                      ),
                    })),
                  );
                  close();
                }
              }}
            >
              Remove from pane
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
