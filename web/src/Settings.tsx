import { useState } from "react";
import { Config, Size, clone, sanitiseExport, validate } from "./model";
import Modal from "./Modal";
import { download } from "./Editors";
import ImportPanel from "./ImportPanel";
export default function Settings({
  config,
  apply,
  imported,
  close,
  readOnly,
}: {
  config: Config;
  apply: (c: Config) => void;
  imported: (c: Config, id?: string) => void;
  close: () => void;
  readOnly: boolean;
}) {
  const [tab, setTab] = useState("appearance"),
    [draft, setDraft] = useState(clone(config)),
    [error, setError] = useState("");
  return (
    <Modal title="Settings" close={close}>
      <nav className="tabs" aria-label="Settings sections">
        {["appearance", "import", "export"].map((s) => (
          <button
            key={s}
            className={tab === s ? "active" : ""}
            onClick={() => setTab(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </nav>
      {readOnly && (
        <p className="notice">
          This screen is read-only at this viewport size. Use a wider desktop
          screen to make changes.
        </p>
      )}
      {tab === "appearance" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const n = {
                ...config,
                dashboard: draft.dashboard,
                appearance: draft.appearance,
              };
              validate(n);
              apply(n);
              close();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <fieldset disabled={readOnly}>
            <label>
              Dashboard title
              <input
                maxLength={100}
                value={draft.dashboard.title}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dashboard: { ...draft.dashboard, title: e.target.value },
                  })
                }
              />
            </label>
            <div className="fields">
              <label>
                Dashboard width
                <select
                  value={
                    draft.dashboard.widthMode === "full"
                      ? "full"
                      : String(
                          draft.dashboard.width === 960 ||
                            draft.dashboard.width === 1200
                            ? draft.dashboard.width
                            : "custom",
                        )
                  }
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dashboard: {
                        ...draft.dashboard,
                        widthMode: e.target.value === "full" ? "full" : "fixed",
                        width: ["960", "1200"].includes(e.target.value)
                          ? Number(e.target.value)
                          : e.target.value === "custom"
                            ? 1000
                            : draft.dashboard.width,
                      },
                    })
                  }
                >
                  <option value="full">Full width</option>
                  <option value="960">960 px</option>
                  <option value="1200">1200 px</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                {draft.dashboard.widthMode === "full"
                  ? "Reference width (px)"
                  : "Width (px)"}
                <input
                  type="number"
                  min={768}
                  max={3840}
                  required
                  value={draft.dashboard.width}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dashboard: {
                        ...draft.dashboard,
                        width: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
            <p className="hint">
              Full width expands to the available desktop space. The reference
              width is the minimum editing width.
            </p>
            <div className="fields">
              <label>
                App size
                <select
                  value={draft.appearance.appSize}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      appearance: {
                        ...draft.appearance,
                        appSize: e.target.value as Size,
                      },
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
              <label>
                Theme
                <select
                  value={draft.appearance.theme}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      appearance: {
                        ...draft.appearance,
                        theme: e.target.value as "dark" | "light",
                      },
                    })
                  }
                >
                  <option value="dark">Midnight</option>
                  <option value="light">Daylight</option>
                </select>
              </label>
            </div>
            {(["showAppLabels", "showButtonLabels"] as const).map((k) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={draft.appearance[k]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      appearance: {
                        ...draft.appearance,
                        [k]: e.target.checked,
                      },
                    })
                  }
                />
                {k === "showAppLabels"
                  ? "App labels"
                  : "Navigation button labels"}
              </label>
            ))}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={readOnly}>
              Apply settings
            </button>
          </div>
        </form>
      )}
      {tab === "import" &&
        (readOnly ? null : (
          <ImportPanel
            config={config}
            imported={(c, id) => {
              imported(c, id);
              close();
            }}
          />
        ))}
      {tab === "export" && (
        <div className="export-options">
          <h3>Share a layout</h3>
          <p>
            Exports structure and icons without app addresses or Docker
            identities. Custom icon URLs remain: review them before sharing.
          </p>
          <button
            onClick={() => download("pane-layout.yaml", sanitiseExport(config))}
          >
            Export shareable layout
          </button>
          <h3>Private backup</h3>
          <p>
            Includes all app addresses and Docker identities. Keep this file
            private.
          </p>
          <button onClick={() => download("pane-backup.yaml", config)}>
            Download full backup
          </button>
        </div>
      )}
    </Modal>
  );
}
