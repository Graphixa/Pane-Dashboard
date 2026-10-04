import { useEffect, useRef, useState } from "react";
import {
  Settings2,
  Palette,
  Image as ImageIcon,
  PanelsTopLeft,
  Archive,
  Info,
} from "lucide-react";
import { Config, clone, sanitiseExport, validate } from "./model";
import { appearanceStyle } from "./appearance";
import AppearanceEditor from "./AppearanceEditor";
import Modal from "./Modal";
import { Button, Text } from "./design/components";
import { download } from "./Editors";
import ImportPanel from "./ImportPanel";
import { version } from "../package.json";

const pages = [
  ["general", "General", Settings2],
  ["appearance", "Appearance", Palette],
  ["background", "Background", ImageIcon],
  ["panes", "Panes", PanelsTopLeft],
  ["backup", "Import & backup", Archive],
  ["about", "About", Info],
] as const;
type Page = (typeof pages)[number][0];
const settingsValue = (c: Config) =>
  JSON.stringify([c.dashboard, c.appearance]);

export default function Settings({
  config,
  apply,
  imported,
  close,
  readOnly,
  onPreview,
}: {
  config: Config;
  apply: (c: Config) => void;
  imported: (c: Config, id?: string) => void;
  close: () => void;
  readOnly: boolean;
  onPreview?: (draft: Config | null) => void;
}) {
  const [page, setPage] = useState<Page>("general");
  const [draft, setDraft] = useState(() => clone(config));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initial = useRef(settingsValue(config));
  const content = useRef<HTMLDivElement>(null);
  const dirty = settingsValue(draft) !== initial.current;
  const previewFrom = (d: Config) =>
    onPreview?.({
      ...config,
      dashboard: d.dashboard,
      appearance: d.appearance,
    });
  const updateDraft = (c: Config) => {
    setDraft(c);
    setError("");
    previewFrom(c);
  };
  const requestClose = () => {
    if (
      (!dirty && !busy) ||
      window.confirm("Discard unsaved settings changes?")
    )
      close();
  };
  useEffect(() => {
    previewFrom(draft);
  }, []);
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
  }, [page]);
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
    page === "general" ||
    page === "appearance" ||
    page === "background" ||
    page === "panes";
  return (
    <Modal
      title="Settings"
      close={requestClose}
      className="settings-dialog"
      style={appearanceStyle(draft.appearance)}
      draggable
    >
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
          <Text as="h2" variant="title" className="settings-page-title">
            {pages.find(([id]) => id === page)?.[1]}
          </Text>
          {readOnly && (
            <p className="notice">
              Use a wider desktop screen to change settings. Backups are still
              available.
            </p>
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
                <div className="settings-sections">
                  <AppearanceEditor
                    draft={draft}
                    change={updateDraft}
                    onBusy={setBusy}
                    section={page}
                  />
                </div>
              </fieldset>
            )}
          </form>
          {page === "backup" && (
            <>
              <section className="settings-section">
                <h3>Export</h3>
                <p className="section-description">
                  {dirty
                    ? "Apply or discard pending changes before downloading."
                    : "Downloads use your saved dashboard."}
                </p>
                <div className="backup-option">
                  <div className="backup-option-copy">
                    <h4>Private backup</h4>
                    <p>
                      Includes app addresses, Docker identities and uploaded
                      images.
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
                  <div className="backup-option-copy">
                    <h4>Share a layout</h4>
                    <p>
                      Omits app addresses and Docker identities. Review images
                      before sharing.
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
              <section className="settings-section">
                <h3>Import</h3>
                {dirty ? (
                  <p className="section-description">
                    Apply your settings first, or cancel and reopen Settings
                    before importing.
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
            <section className="settings-section">
              <h3>Pane</h3>
              <p className="section-description">Version {version}</p>
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
          <Button onClick={requestClose}>Cancel</Button>
          <Button
            type="submit"
            form="settings-form"
            variant="primary"
            disabled={readOnly || busy}
          >
            Apply settings
          </Button>
        </div>
      </div>
    </Modal>
  );
}

