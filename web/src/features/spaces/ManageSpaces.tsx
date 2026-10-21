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
  MAX_SPACES,
  clone,
  duplicateSpace,
  spaceNameKey,
  uid,
  validate,
} from "../../model";

export function ManageSpaces({
  config,
  activeSpaceId,
  apply,
  onSelect,
  close,
}: {
  config: Config;
  activeSpaceId: string;
  apply: (c: Config) => void;
  onSelect: (spaceId: string) => void;
  close: () => void;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [error, setError] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const save = (next: Config, selectId?: string) => {
    validate(next);
    apply(next);
    if (selectId) onSelect(selectId);
    setError("");
  };

  const createEmpty = () => {
    try {
      if (config.spaces.length >= MAX_SPACES)
        throw Error(`At most ${MAX_SPACES} spaces are supported.`);
      const n = clone(config);
      let name = "New space";
      let i = 2;
      while (n.spaces.some((s) => spaceNameKey(s.name) === spaceNameKey(name))) {
        name = `New space ${i++}`;
      }
      const space = { id: uid(), name, items: [] };
      n.spaces.push(space);
      save(n, space.id);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const duplicate = (id: string) => {
    try {
      if (config.spaces.length >= MAX_SPACES)
        throw Error(`At most ${MAX_SPACES} spaces are supported.`);
      const source = config.spaces.find((s) => s.id === id);
      if (!source) throw Error("This space no longer exists.");
      let name = `${source.name} copy`;
      let i = 2;
      while (config.spaces.some((s) => spaceNameKey(s.name) === spaceNameKey(name))) {
        name = `${source.name} copy ${i++}`;
      }
      const n = clone(config);
      const copy = duplicateSpace(source, name);
      const index = n.spaces.findIndex((s) => s.id === id);
      n.spaces.splice(index + 1, 0, copy);
      save(n, copy.id);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    try {
      const n = clone(config);
      const i = n.spaces.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= n.spaces.length) return;
      const tmp = n.spaces[i];
      n.spaces[i] = n.spaces[j];
      n.spaces[j] = tmp;
      save(n);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setDefault = (id: string) => {
    try {
      const n = clone(config);
      n.defaultSpaceId = id;
      save(n);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const commitRename = () => {
    try {
      if (!renameId) return;
      const n = clone(config);
      const space = n.spaces.find((s) => s.id === renameId);
      if (!space) throw Error("This space no longer exists.");
      space.name = renameValue.trim();
      save(n);
      setRenameId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    const space = config.spaces.find((s) => s.id === id);
    if (!space) return;
    if (config.spaces.length <= 1) {
      setError("You cannot delete the final space.");
      return;
    }
    const isDefault = config.defaultSpaceId === id;
    let replacement = config.spaces.find((s) => s.id !== id)?.id;
    if (
      !(await confirm({
        title: "Delete space?",
        description: isDefault
          ? `Delete “${space.name}”? Its pane layout will be removed. Shared app definitions stay. Choose a new default after deletion.`
          : `Delete “${space.name}”? Its pane layout and placements will be removed. Shared app definitions stay.`,
        cancelLabel: "Cancel",
        actionLabel: "Delete space",
      }))
    )
      return;
    try {
      const n = clone(config);
      n.spaces = n.spaces.filter((s) => s.id !== id);
      if (isDefault) {
        replacement = n.spaces[0]?.id;
        if (!replacement) throw Error("You cannot delete the final space.");
        n.defaultSpaceId = replacement;
      }
      const nextActive =
        activeSpaceId === id ? n.defaultSpaceId : activeSpaceId;
      save(n, nextActive);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal title="Manage spaces" close={close}>
      {confirmation}
      <p className="section-description">
        Create spaces to organise your panes and widgets into different layouts.
      </p>
      <div className="ui-actions" style={{ marginBottom: "var(--space-3)" }}>
        <Button type="button" variant="primary" onClick={createEmpty}>
          New space
        </Button>
      </div>
      <ul className="spaces-manage-list">
        {config.spaces.map((s, index) => (
          <li key={s.id}>
            {renameId === s.id ? (
              <div className="fields">
                <TextField
                  label="Space name"
                  value={renameValue}
                  maxLength={48}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <div className="ui-actions">
                  <Button type="button" onClick={() => setRenameId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" onClick={commitRename}>
                    Save name
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <strong>
                  {s.name}
                  {s.id === config.defaultSpaceId ? " (default)" : ""}
                </strong>
                <div className="ui-actions">
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={index === 0}
                    onClick={() => move(s.id, -1)}
                  >
                    Move earlier
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={index === config.spaces.length - 1}
                    onClick={() => move(s.id, 1)}
                  >
                    Move later
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setRenameId(s.id);
                      setRenameValue(s.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => duplicate(s.id)}
                  >
                    Duplicate
                  </Button>
                  {s.id !== config.defaultSpaceId && (
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => setDefault(s.id)}
                    >
                      Set as default
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => void remove(s.id)}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && <Notice tone="error">{error}</Notice>}
    </Modal>
  );
}
