import { useEffect, useRef, useState } from "react";
import { Config, clone, validate } from "../../model";
import {
  appearanceStyle,
  defaultBackground,
  normaliseBackground,
} from "../../appearance";
import {
  Button,
  FieldGroup,
  Modal,
  Notice,
  Text,
  useConfirmation,
} from "../../design/components";
import {
  flushPendingRecentWallpaper,
  loadRecentDraft,
  queueRecentWallpaperOnSave,
} from "../../wallpaperRecent";
import type { SaveOutcome } from "../../useConfig";
import {
  ConfigValidationError,
  firstSettingsIssue,
  settingsTarget,
  type SettingsPage,
  type ValidationIssue,
} from "../../validation";
import {
  SettingsNavigation,
  settingsPages,
  type SettingsNavPage,
} from "./SettingsNavigation";
import { SettingsFooter } from "./SettingsFooter";
import GeneralSettings from "./GeneralSettings";
import AppearanceSettings from "./AppearanceSettings";
import PaneFinishSettings from "./PaneFinishSettings";
import ImportBackupSettings from "./ImportBackupSettings";
import AboutSettings from "./AboutSettings";
import BackgroundSettings from "./background/BackgroundSettings";
import { useAppearanceDraftHelpers } from "./draftHelpers";

const settingsValue = (c: Config) =>
  JSON.stringify([c.dashboard, c.appearance]);

type ApplyPhase = "idle" | "saving" | "failed" | "conflict";

export default function Settings({
  config,
  commitSettings,
  discardSettings,
  imported,
  close,
  readOnly,
  onPreview,
  activeSpaceId,
}: {
  config: Config;
  commitSettings: (settings: {
    dashboard: Config["dashboard"];
    appearance: Config["appearance"];
  }) => Promise<SaveOutcome>;
  discardSettings: () => void;
  imported: (c: Config, id?: string) => void;
  close: () => void;
  readOnly: boolean;
  onPreview?: (draft: Config | null) => void;
  activeSpaceId?: string;
}) {
  const { confirm, confirmation } = useConfirmation();
  const [page, setPage] = useState<SettingsNavPage>("general");
  const [draft, setDraft] = useState(() => clone(config));
  const [recent, setRecent] = useState(() =>
    loadRecentDraft(config.appearance.background),
  );
  const initialRecent = useRef(JSON.stringify(recent));
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [openDisclosures, setOpenDisclosures] = useState<string[]>([]);
  const [phase, setPhase] = useState<ApplyPhase>("idle");
  const [busy, setBusy] = useState(false);
  const [previewAdjust, setPreviewAdjust] = useState(false);
  const initial = useRef(settingsValue(config));
  const content = useRef<HTMLDivElement>(null);
  const pendingPreview = useRef<Config | null>(null);
  const previewFrame = useRef(0);
  const onPreviewRef = useRef(onPreview);
  const configRef = useRef(config);
  const session = useRef(0);
  const submittedBody = useRef<string | null>(null);
  onPreviewRef.current = onPreview;
  configRef.current = config;
  const dirty =
    settingsValue(draft) !== initial.current ||
    JSON.stringify(recent) !== initialRecent.current;
  const blocked = dirty || phase === "saving" || phase === "failed" || phase === "conflict";
  const mutationsFrozen = phase === "saving" || busy;

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
  const clearValidation = () => {
    setFormError("");
    setFieldErrors({});
    setIssues([]);
    setFocusPath(null);
  };
  const updateRecent: typeof setRecent = (value) => {
    if (phase === "saving") return;
    setRecent(value);
    clearValidation();
    if (phase === "failed" || phase === "conflict") setPhase("idle");
  };
  const updateDraft = (c: Config | ((prev: Config) => Config)) => {
    if (phase === "saving") return;
    setDraft((prev) => {
      const next = typeof c === "function" ? c(prev) : c;
      clearValidation();
      if (phase === "failed" || phase === "conflict") setPhase("idle");
      previewFrom(next);
      return next;
    });
  };
  const restoreAndClose = () => {
    queueRecentWallpaperOnSave(undefined);
    // Drop any optimistic settings snapshot left by a failed Apply.
    if (phase === "failed" || phase === "conflict" || dirty)
      discardSettings();
    close();
  };
  const requestClose = async () => {
    if (phase === "saving") return;
    if (
      (!dirty && !busy && phase === "idle") ||
      (await confirm({
        title: "Discard changes?",
        description: "Discard unsaved settings changes?",
        cancelLabel: "Keep changes",
        actionLabel: "Discard",
      }))
    )
      restoreAndClose();
  };
  useEffect(() => {
    previewFrom(draft);
    return () => {
      session.current += 1;
      if (previewFrame.current) cancelAnimationFrame(previewFrame.current);
      previewFrame.current = 0;
      // Publish the latest pending snapshot before unmount; Dashboard clears on close.
      if (pendingPreview.current) flushPreview();
    };
  }, []);
  useEffect(() => {
    if (!dirty && !busy && phase === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, phase]);
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [page]);
  useEffect(() => {
    if (!focusPath) return;
    const id = window.setTimeout(() => {
      const el = content.current?.querySelector<HTMLElement>(
        `[data-settings-field="${focusPath}"]`,
      );
      el?.focus();
      setFocusPath(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusPath, page, openDisclosures]);

  const routeValidation = (nextIssues: ValidationIssue[]) => {
    setIssues(nextIssues);
    const map: Record<string, string> = {};
    for (const issue of nextIssues) {
      if (issue.path && !map[issue.path]) map[issue.path] = issue.message;
    }
    setFieldErrors(map);
    const primary = firstSettingsIssue(nextIssues);
    if (!primary) {
      setFormError(nextIssues[0]?.message || "Invalid configuration.");
      return;
    }
    const target = settingsTarget(primary);
    if (target.page) setPage(target.page as SettingsPage);
    if (target.disclosure)
      setOpenDisclosures((prev) =>
        prev.includes(target.disclosure!) ? prev : [...prev, target.disclosure!],
      );
    setFocusPath(primary.path);
    setFormError("");
  };

  const submit = async () => {
    if (mutationsFrozen || readOnly) return;
    const next = {
      ...configRef.current,
      dashboard: draft.dashboard,
      appearance: draft.appearance,
    };
    try {
      validate(next);
    } catch (e) {
      if (e instanceof ConfigValidationError) routeValidation(e.issues);
      else setFormError((e as Error).message);
      setPhase("failed");
      return;
    }
    clearValidation();
    const mySession = session.current;
    const body = JSON.stringify(next);
    submittedBody.current = body;
    setPhase("saving");
    const outcome = await commitSettings({
      dashboard: draft.dashboard,
      appearance: draft.appearance,
    });
    if (mySession !== session.current || submittedBody.current !== body) return;
    if (outcome.status === "saved") {
      // Queue after the matching ack so an older autosave cannot flush history.
      queueRecentWallpaperOnSave(outcome.config.appearance.background, recent);
      flushPendingRecentWallpaper(outcome.config.appearance.background);
      setPhase("idle");
      close();
      return;
    }
    if (outcome.status === "conflict") {
      setPhase("conflict");
      setFormError(
        outcome.error ||
          "Configuration changed elsewhere. Reload to continue, or keep editing this draft.",
      );
      return;
    }
    setPhase("failed");
    setFormError(outcome.error || "Could not save settings.");
  };

  const reloadConflict = async () => {
    if (
      await confirm({
        title: "Reload dashboard?",
        description:
          "Reload and discard unsaved settings changes from this session?",
        cancelLabel: "Keep draft",
        actionLabel: "Reload",
      })
    )
      window.location.reload();
  };

  const editable =
    page === "general" ||
    page === "appearance" ||
    page === "background" ||
    page === "panes";

  const statusMessage = () => {
    if (phase === "saving") return "Saving settings…";
    if (formError)
      return (
        <Notice tone="error">
          <div className="settings-error-stack">
            <span>{formError}</span>
            {phase === "conflict" && (
              <div className="ui-actions">
                <Button type="button" onClick={() => void reloadConflict()}>
                  Reload
                </Button>
              </div>
            )}
            {phase === "failed" && (
              <div className="ui-actions">
                <Button type="button" onClick={() => void submit()}>
                  Retry save
                </Button>
              </div>
            )}
            {issues.length > 1 && (
              <ul className="settings-error-links">
                {issues.map((issue) => {
                  const target = settingsTarget(issue);
                  if (!target.page) return null;
                  return (
                    <li key={`${issue.path}:${issue.code}`}>
                      <button
                        type="button"
                        className="settings-error-link"
                        onClick={() => {
                          setPage(target.page as SettingsPage);
                          if (target.disclosure)
                            setOpenDisclosures((prev) =>
                              prev.includes(target.disclosure!)
                                ? prev
                                : [...prev, target.disclosure!],
                            );
                          setFocusPath(issue.path);
                        }}
                      >
                        {issue.message}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Notice>
      );
    if (Object.keys(fieldErrors).length)
      return (
        <Notice tone="error">
          <div className="settings-error-stack">
            <span>{Object.values(fieldErrors)[0]}</span>
            {issues.length > 1 && (
              <ul className="settings-error-links">
                {issues.slice(1).map((issue) => {
                  const target = settingsTarget(issue);
                  if (!target.page) return null;
                  return (
                    <li key={`${issue.path}:${issue.code}`}>
                      <button
                        type="button"
                        className="settings-error-link"
                        onClick={() => {
                          setPage(target.page as SettingsPage);
                          if (target.disclosure)
                            setOpenDisclosures((prev) =>
                              prev.includes(target.disclosure!)
                                ? prev
                                : [...prev, target.disclosure!],
                            );
                          setFocusPath(issue.path);
                        }}
                      >
                        {issue.message}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Notice>
      );
    if (busy) return "Preparing image…";
    if (dirty) return "Unsaved changes";
    return "Settings are up to date";
  };

  const { background } = useAppearanceDraftHelpers(updateDraft);
  const backgroundSettings = normaliseBackground(
    draft.appearance.background ?? defaultBackground,
  );

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
        <SettingsNavigation
          page={page}
          disabled={mutationsFrozen}
          onNavigate={setPage}
        />
        <div className="settings-content" ref={content}>
          <Text as="h2" variant="title" className="settings-page-title">
            {settingsPages.find(([id]) => id === page)?.[1]}
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
              void submit();
            }}
          >
            {editable && (
              <FieldGroup disabled={readOnly || phase === "saving"}>
                <div className="settings-sections">
                  {page === "general" && (
                    <GeneralSettings
                      draft={draft}
                      change={updateDraft}
                      onBusy={setBusy}
                      fieldErrors={fieldErrors}
                    />
                  )}
                  {page === "appearance" && (
                    <AppearanceSettings
                      draft={draft}
                      change={updateDraft}
                      fieldErrors={fieldErrors}
                      openDisclosures={openDisclosures}
                      onDisclosureOpen={(title, open) =>
                        setOpenDisclosures((prev) =>
                          open
                            ? prev.includes(title)
                              ? prev
                              : [...prev, title]
                            : prev.filter((t) => t !== title),
                        )
                      }
                    />
                  )}
                  {page === "background" && (
                    <BackgroundSettings
                      recent={recent}
                      setRecent={updateRecent}
                      settings={backgroundSettings}
                      theme={draft.appearance.theme}
                      onBusy={setBusy}
                      background={background}
                      onPreviewAdjust={setPreviewAdjust}
                    />
                  )}
                  {page === "panes" && (
                    <PaneFinishSettings draft={draft} change={updateDraft} />
                  )}
                </div>
              </FieldGroup>
            )}
          </form>
          {page === "backup" && (
            <ImportBackupSettings
              config={config}
              blocked={blocked}
              busy={busy}
              readOnly={readOnly}
              imported={imported}
              close={close}
              activeSpaceId={activeSpaceId}
            />
          )}
          {page === "about" && <AboutSettings />}
        </div>
      </div>
      <SettingsFooter
        status={statusMessage()}
        saving={phase === "saving"}
        applyDisabled={readOnly || busy || phase === "saving"}
        onCancel={() => void requestClose()}
      />
    </Modal>
  );
}
