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
import {
  Button,
  FieldGroup,
  Modal,
  Notice,
  Section,
  SettingsGroup,
  SettingsRow,
  Text,
  useConfirmation,
} from "./design/components";
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
  const { confirm, confirmation } = useConfirmation();
  const [page, setPage] = useState<Page>("general");
  const [draft, setDraft] = useState(() => clone(config));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewAdjust, setPreviewAdjust] = useState(false);
  const initial = useRef(settingsValue(config));
  const content = useRef<HTMLDivElement>(null);
  const pendingPreview = useRef<Config | null>(null);
  const previewFrame = useRef(0);
  const onPreviewRef = useRef(onPreview);
  const configRef = useRef(config);
  onPreviewRef.current = onPreview;
  configRef.current = config;
  const dirty = settingsValue(draft) !== initial.current;
  const flushPreview = () => {
    previewFrame.current = 0;
    const next = pendingPreview.current;
    pendingPreview.current = null;
    if (next) onPreviewRef.current?.(next);
  };
  /** Coalesce shell previews to one per frame so colour-drag ticks do not thrash glass. */
  const previewFrom = (d: Config) => {
    if (!onPreviewRef.current) return;
    const base = configRef.current;
    pendingPreview.current = {
      ...base,
      dashboard: d.dashboard,
      appearance: d.appearance,
    };
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(flushPreview);
  };
  const updateDraft = (c: Config | ((prev: Config) => Config)) => {
    setDraft((prev) => {
      const next = typeof c === "function" ? c(prev) : c;
      setError("");
      previewFrom(next);
      return next;
    });
  };
  const requestClose = async () => {
    if (
      (!dirty && !busy) ||
      await confirm({
        title: "Discard changes?",
        description: "Discard unsaved settings changes?",
        cancelLabel: "Keep changes",
        actionLabel: "Discard",
      })
    )
      close();
  };
  useEffect(() => {
    previewFrom(draft);
    return () => {
      if (previewFrame.current) cancelAnimationFrame(previewFrame.current);
      previewFrame.current = 0;
      // Publish the latest pending snapshot before unmount; Dashboard clears on close.
      if (pendingPreview.current) flushPreview();
    };
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
      backdrop="none"
      className={`settings-dialog${previewAdjust ? " settings-dialog--preview-adjust" : ""}`}
      style={appearanceStyle(draft.appearance)}
      theme={draft.appearance.theme}
      draggable
    >
      {confirmation}
      <div className="settings-body">
        <nav className="settings-sidebar" aria-label="Settings sections">
          {pages.map(([id, label, Icon]) => (
            <Button
              type="button"
              key={id}
              className="ui-settings-nav"
              disabled={busy}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="settings-content" ref={content}>
          <Text as="h2" variant="title" className="settings-page-title">
            {pages.find(([id]) => id === page)?.[1]}
          </Text>
          {readOnly && (
            <Notice>
              Use a wider desktop screen to change settings. Backups are still
              available.
            </Notice>
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
              <FieldGroup disabled={readOnly || busy}>
                <div className="settings-sections">
                  <AppearanceEditor
                    draft={draft}
                    change={updateDraft}
                    onBusy={setBusy}
                    section={page}
                    onPreviewAdjust={setPreviewAdjust}
                  />
                </div>
              </FieldGroup>
            )}
          </form>
          {page === "backup" && (
            <>
              <Section
                level="h3"
                className="settings-section"
                title="Export"
                tip={
                  dirty
                    ? "Apply or discard pending changes before downloading."
                    : "Downloads use your saved dashboard."
                }
              >
                <SettingsGroup>
                  <SettingsRow
                    label="Private backup"
                    hint="Includes app addresses, Docker identities and uploaded images."
                  >
                    <Button
                      type="button"
                      disabled={dirty || busy}
                      onClick={() => download("pane-backup.yaml", config)}
                    >
                      Download full backup
                    </Button>
                  </SettingsRow>
                  <SettingsRow
                    label="Share a layout"
                    hint="Omits app addresses and Docker identities. Review images before sharing."
                  >
                    <Button
                      type="button"
                      disabled={dirty || busy}
                      onClick={() =>
                        download("pane-layout.yaml", sanitiseExport(config))
                      }
                    >
                      Export shareable layout
                    </Button>
                  </SettingsRow>
                </SettingsGroup>
              </Section>
              <Section
                level="h3"
                className="settings-section"
                title="Import"
                tip={
                  dirty
                    ? "Apply your settings first, or cancel and reopen Settings before importing."
                    : undefined
                }
              >
                {!dirty && !readOnly && (
                  <SettingsGroup>
                    <SettingsRow>
                      <ImportPanel
                        config={config}
                        imported={(c, id) => {
                          imported(c, id);
                          close();
                        }}
                      />
                    </SettingsRow>
                  </SettingsGroup>
                )}
              </Section>
            </>
          )}
          {page === "about" && (
            <Section
              level="h3"
              className="settings-section"
              title="Pane"
              description={`Version ${version}`}
            >
              <Text>A self-hosted dashboard for your apps.</Text>
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
            </Section>
          )}
        </div>
      </div>
      <div className="settings-footer">
        <div className="settings-status" aria-live="polite">
          {error ? (
            <Notice tone="error">{error}</Notice>
          ) : busy ? (
            "Preparing image…"
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "Settings are up to date"
          )}
        </div>
        <div className="ui-actions settings-footer-actions">
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

