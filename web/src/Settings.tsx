import { useEffect, useRef, useState } from "react";
import { Settings2, Palette, PanelsTopLeft, Archive, Info } from "lucide-react";
import { Config, clone, sanitiseExport, validate } from "./model";
import AppearanceEditor from "./AppearanceEditor";
import Modal from "./Modal";
import { download } from "./Editors";
import ImportPanel from "./ImportPanel";
import { version } from "../package.json";

const pages = [
  ["general", "General", Settings2],
  ["appearance", "Appearance", Palette],
  ["panes", "Panes", PanelsTopLeft],
  ["backup", "Import & backup", Archive],
  ["about", "About", Info],
] as const;
const appearanceTabs = [
  "theme",
  "colours",
  "background",
  "typography",
] as const;
type Page = (typeof pages)[number][0];
type AppearanceTab = (typeof appearanceTabs)[number];
const settingsValue = (c: Config) =>
  JSON.stringify([c.dashboard, c.appearance]);

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
  const [page, setPage] = useState<Page>("general");
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>("theme");
  const [draft, setDraft] = useState(() => clone(config));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initial = useRef(settingsValue(config));
  const content = useRef<HTMLDivElement>(null);
  const dirty = settingsValue(draft) !== initial.current;
  const requestClose = () => {
    if (
      (!dirty && !busy) ||
      window.confirm("Discard unsaved settings changes?")
    )
      close();
  };
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [page, appearanceTab]);
  const submit = () => {
    if (busy || readOnly) return;
    try {
      const next = {
        ...config,
        dashboard: draft.dashboard,
        appearance: draft.appearance,
      };
      validate(next);
      apply(next);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const editable =
    page === "general" || page === "appearance" || page === "panes";
  return (
    <Modal title="Settings" close={requestClose} className="settings-dialog">
      <div className="settings-body">
        <nav className="settings-sidebar" aria-label="Settings sections">
          {pages.map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              disabled={busy}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content" ref={content}>
          <h2 className="settings-page-title">
            {pages.find(([id]) => id === page)?.[1]}
          </h2>
          {readOnly && (
            <p className="notice">
              Use a wider desktop screen to change settings. Backups are still
              available.
            </p>
          )}
          {page === "appearance" && (
            <div
              className="settings-subtabs"
              role="tablist"
              aria-label="Appearance sections"
            >
              {appearanceTabs.map((tab, index) => (
                <button
                  type="button"
                  role="tab"
                  key={tab}
                  id={`settings-tab-${tab}`}
                  aria-controls="settings-appearance-panel"
                  aria-selected={appearanceTab === tab}
                  tabIndex={appearanceTab === tab ? 0 : -1}
                  disabled={busy}
                  onClick={() => setAppearanceTab(tab)}
                  onKeyDown={(e) => {
                    const next =
                      e.key === "ArrowRight"
                        ? (index + 1) % 4
                        : e.key === "ArrowLeft"
                          ? (index + 3) % 4
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? 3
                              : -1;
                    if (next >= 0) {
                      e.preventDefault();
                      setAppearanceTab(appearanceTabs[next]);
                      document
                        .getElementById(`settings-tab-${appearanceTabs[next]}`)
                        ?.focus();
                    }
                  }}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}
          <form
            id="settings-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {editable && (
              <fieldset disabled={readOnly || busy}>
                <div
                  id={
                    page === "appearance"
                      ? "settings-appearance-panel"
                      : undefined
                  }
                  role={page === "appearance" ? "tabpanel" : undefined}
                  aria-labelledby={
                    page === "appearance"
                      ? `settings-tab-${appearanceTab}`
                      : undefined
                  }
                >
                  {page === "panes" && (
                    <p>One consistent finish for every pane.</p>
                  )}
                  <AppearanceEditor
                    draft={draft}
                    change={(c) => {
                      setDraft(c);
                      setError("");
                    }}
                    onBusy={setBusy}
                    section={page === "appearance" ? appearanceTab : page}
                  />
                </div>
              </fieldset>
            )}
          </form>
          {page === "backup" && (
            <>
              <section className="settings-card">
                <h3>Export</h3>
                <p>
                  Exports use your saved dashboard. Apply pending changes before
                  downloading.
                </p>
                <div className="backup-option">
                  <div>
                    <h4>Private backup</h4>
                    <p>
                      Includes app addresses, Docker identities and uploaded
                      images. Keep this file private.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={dirty || busy}
                    onClick={() => download("pane-backup.yaml", config)}
                  >
                    Download full backup
                  </button>
                </div>
                <div className="backup-option">
                  <div>
                    <h4>Share a layout</h4>
                    <p>
                      Omits app addresses and Docker identities. Images and
                      image URLs remain; review before sharing.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={dirty || busy}
                    onClick={() =>
                      download("pane-layout.yaml", sanitiseExport(config))
                    }
                  >
                    Export shareable layout
                  </button>
                </div>
              </section>
              <section className="settings-card">
                <h3>Import</h3>
                {dirty ? (
                  <p className="notice">
                    Apply your settings first, or cancel and reopen Settings
                    before importing a layout.
                  </p>
                ) : (
                  !readOnly && (
                    <ImportPanel
                      config={config}
                      imported={(c, id) => {
                        imported(c, id);
                        close();
                      }}
                    />
                  )
                )}
              </section>
            </>
          )}
          {page === "about" && (
            <section className="settings-card">
              <h3>Pane</h3>
              <p>Version {version}</p>
              <p>A self-hosted dashboard for your apps.</p>
              <div className="about-links">
                <a
                  href="https://github.com/Graphixa/Pane-Dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/Graphixa/Pane-Dashboard/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  Report an issue
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="settings-footer">
        <div className="settings-status" aria-live="polite">
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : busy ? (
            "Preparing image…"
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "Settings are up to date"
          )}
        </div>
        <div className="settings-footer-actions">
          <button type="button" onClick={requestClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="settings-form"
            className="primary"
            disabled={readOnly || busy}
          >
            Apply settings
          </button>
        </div>
      </div>
    </Modal>
  );
}
