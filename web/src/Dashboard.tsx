import { CSSProperties, useEffect, useState } from "react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";
import {
  Plus,
  Hammer,
  Settings as Gear,
  Grip,
  Ellipsis,
  LayoutGrid,
  ArrowUpRight,
  Check,
  AlertCircle,
} from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  App,
  Config,
  Pane,
  canPresent,
  capacity,
  clone,
  minimum,
  moveApp,
  newPane,
  sizes,
} from "./model";
import { iconURL } from "./icons";
import { useConfig } from "./useConfig";
import { AppEditor, PaneEditor } from "./Editors";
import Settings from "./Settings";
const compactor = getCompactor(null, false, true);
type Editor =
  | { type: "app"; paneId: string; app?: App; col: number; row: number }
  | { type: "pane"; pane: Pane }
  | { type: "settings" }
  | null;
function Artwork({ app }: { app: App }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [app.icon]);
  return (
    <span className="artwork">
      {app.icon && !broken ? (
        <img
          src={iconURL(app.icon)}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{app.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
export default function Dashboard() {
  const state = useConfig();
  if (!state.config)
    return (
      <main className="loading">
        <LayoutGrid size={36} />
        <h1>Pane</h1>
        <p role="status">{state.error || "Opening your dashboard…"}</p>
        {state.error && (
          <button onClick={() => window.location.reload()}>Retry</button>
        )}
      </main>
    );
  return <DashboardView {...state} config={state.config} />;
}
function DashboardView({
  config,
  change,
  status,
  error,
  retry,
}: ReturnType<typeof useConfig> & { config: Config }) {
  const { width: availableWidth, containerRef, mounted } = useContainerWidth();
  const [edit, setEdit] = useState(false),
    [editor, setEditor] = useState<Editor>(null),
    [addMenu, setAddMenu] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(""),
    [dragged, setDragged] = useState<string | null>(null);
  const width = config
    ? config.dashboard.widthMode === "full"
      ? Math.max(config.dashboard.width, availableWidth)
      : config.dashboard.width
    : 960;
  const mobile =
    !!config &&
    (availableWidth < config.dashboard.width ||
      availableWidth < 768 ||
      !canPresent(config, width));
  const editing = edit && !mobile && status !== "Conflict";
  useEffect(() => {
    if (mobile) {
      setEdit(false);
      setEditor(null);
      setAddMenu(false);
    }
  }, [mobile]);
  useEffect(() => {
    if (config) {
      document.documentElement.dataset.theme = config.appearance.theme;
      document.title = `${config.dashboard.title || "Home"} · Pane`;
    }
  }, [config?.appearance.theme, config?.dashboard.title]);
  const apply = (next: Config) => {
    change(next);
    setMessage("");
  };
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const labels = config.appearance.showButtonLabels,
    size = sizes[config.appearance.appSize];
  const add = () =>
    attempt(() => {
      const n = clone(config);
      const pane = newPane(n);
      n.items.push(pane);
      apply(n);
      setEdit(true);
      setSelected(pane.id);
      setAddMenu(false);
      setEditor({ type: "pane", pane });
    });
  const updateLayout = (layout: Layout) => {
    if (!editing) return;
    attempt(() => {
      const n = clone(config);
      for (const p of n.items) {
        const l = layout.find((l) => l.i === p.id);
        if (l) p.layout = { x: l.x, y: l.y, w: l.w, h: l.h };
      }
      if (JSON.stringify(n) !== JSON.stringify(config)) apply(n);
    });
  };
  const openApp = (p: Pane, a: App) =>
    setEditor({ type: "app", paneId: p.id, app: a, col: a.col, row: a.row });
  const tile = (p: Pane, a: App) => (
    <div
      key={a.id}
      className="app-tile"
      style={mobile ? undefined : { gridColumn: a.col + 1, gridRow: a.row + 1 }}
      draggable={editing}
      onDragStart={(e) => {
        if (!editing) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        setDragged(a.id);
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragged(null)}
    >
      {editing ? (
        <button
          className="app-link"
          aria-label={`Edit ${a.name}`}
          onClick={() => openApp(p, a)}
          title={`Edit ${a.name}`}
        >
          <Artwork app={a} />
          {config.appearance.showAppLabels && (
            <span className="app-name">{a.name}</span>
          )}
        </button>
      ) : (
        <a
          className="app-link"
          aria-label={a.name}
          href={a.url || undefined}
          aria-disabled={!a.url}
          title={a.url ? a.name : `${a.name}: address not configured`}
          target={a.openInNewTab ? "_blank" : undefined}
          rel="noopener noreferrer"
        >
          <Artwork app={a} />
          {config.appearance.showAppLabels && (
            <span className="app-name">{a.name}</span>
          )}
        </a>
      )}
    </div>
  );
  const paneContent = (p: Pane) => {
    const cap = capacity(
      p.layout,
      Math.min(width, config.dashboard.width),
      config.appearance.appSize,
    );
    return (
      <section
        className={`pane ${selected === p.id && editing ? "focused" : ""}`}
        aria-label={p.title || "Untitled pane"}
      >
        <div className={`pane-header ${editing ? "pane-drag" : ""}`}>
          <h2>
            {editing && <Grip size={15} />}
            <span>{p.title || (editing ? "Untitled pane" : "")}</span>
          </h2>
          {editing && (
            <button
              className="icon-button pane-controls"
              aria-label={`Edit ${p.title || "untitled pane"}`}
              onClick={() => setEditor({ type: "pane", pane: p })}
            >
              <Ellipsis size={20} />
            </button>
          )}
        </div>
        <div
          className={`app-grid ${mobile ? "mobile-apps" : ""}`}
          style={
            mobile
              ? undefined
              : {
                  gridTemplateColumns: `repeat(${cap.cols}, ${size.w}px)`,
                  gridAutoRows: `${size.h}px`,
                }
          }
        >
          {editing &&
            Array.from({ length: cap.cols * cap.rows }, (_, i) => {
              const col = i % cap.cols,
                row = Math.floor(i / cap.cols);
              if (p.apps.some((a) => a.col === col && a.row === row))
                return null;
              return (
                <button
                  key={`slot-${i}`}
                  className={`empty-slot ${dragged ? "drop-ready" : ""}`}
                  aria-label={`Add app at column ${col + 1}, row ${row + 1}`}
                  style={{ gridColumn: col + 1, gridRow: row + 1 }}
                  onClick={() =>
                    setEditor({ type: "app", paneId: p.id, col, row })
                  }
                  onDragOver={(e) => {
                    if (dragged) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragged)
                      attempt(() =>
                        apply(moveApp(config, dragged, p.id, col, row)),
                      );
                    setDragged(null);
                  }}
                >
                  <Plus size={18} />
                </button>
              );
            })}
          {[...p.apps]
            .sort((a, b) => a.row - b.row || a.col - b.col)
            .map((a) => tile(p, a))}
        </div>
      </section>
    );
  };
  return (
    <div
      className="shell"
      style={
        {
          "--icon-size": `${size.icon}px`,
          "--cell-width": `${size.w}px`,
          "--cell-height": `${size.h}px`,
        } as CSSProperties
      }
    >
      <header className="topbar">
        <a href="#" className="brand" aria-label="Pane home">
          <span className="brand-mark">
            <LayoutGrid size={23} />
          </span>
          <span>
            pane<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-right">
          <span
            className={`save-status ${status === "Saved" ? "" : "pending"}`}
            role="status"
          >
            {status === "Saved" ? (
              <Check size={13} />
            ) : (
              <AlertCircle size={13} />
            )}{" "}
            {status}
          </span>
          <div className="nav-actions">
            <div className="add-wrap">
              <button
                className="nav-button"
                disabled={mobile || status === "Conflict"}
                title="Add"
                aria-label="Add"
                aria-expanded={addMenu}
                onClick={() => setAddMenu(!addMenu)}
              >
                <span>
                  <Plus size={21} />
                </span>
                {labels && <small>Add</small>}
              </button>
              {addMenu && (
                <div className="dropdown">
                  <button onClick={add}>
                    <LayoutGrid size={16} />
                    Add pane
                  </button>
                  <button disabled>
                    Widget <small>Coming later</small>
                  </button>
                  <button onClick={() => setAddMenu(false)}>Close menu</button>
                </div>
              )}
            </div>
            <button
              className={`nav-button ${editing ? "active" : ""}`}
              disabled={mobile || status === "Conflict"}
              aria-label={editing ? "Done editing" : "Edit dashboard"}
              aria-pressed={editing}
              title={editing ? "Done editing" : "Edit dashboard"}
              onClick={() => {
                setEdit(!edit);
                setAddMenu(false);
              }}
            >
              <span>
                <Hammer size={20} />
              </span>
              {labels && <small>{editing ? "Done" : "Edit"}</small>}
            </button>
            <button
              className="nav-button"
              title="Settings"
              aria-label="Settings"
              onClick={() => {
                setEditor({ type: "settings" });
                setAddMenu(false);
              }}
            >
              <span>
                <Gear size={20} />
              </span>
              {labels && <small>Settings</small>}
            </button>
          </div>
        </div>
      </header>
      <main>
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">YOUR SPACE, CONNECTED</p>
            <h1>{config.dashboard.title || "Home"}</h1>
            <p className="subtitle">
              {editing
                ? "Make room for what matters. Drag, resize and arrange your apps."
                : "Everything you need, right where you left it."}
            </p>
          </div>
          <span className={`mode-badge ${editing ? "editing" : ""}`}>
            {editing ? (
              <>
                <Hammer size={13} />
                Edit mode
              </>
            ) : (
              <>
                {config.items.reduce((n, p) => n + p.apps.length, 0)} apps{" "}
                <span>·</span> {config.items.length} panes
              </>
            )}
          </span>
        </div>
        {(error || message) && (
          <div className="error banner" role="alert">
            {message || error}
            {error && (
              <button
                onClick={() =>
                  status === "Conflict"
                    ? window.confirm(
                        "Reload and discard unsaved changes from this session?",
                      ) && window.location.reload()
                    : retry()
                }
              >
                {status === "Conflict" ? "Reload" : "Retry save"}
              </button>
            )}
            {message && <button onClick={() => setMessage("")}>Dismiss</button>}
          </div>
        )}
        <div
          ref={containerRef}
          className={`workspace ${editing ? "editing-grid" : ""}`}
        >
          {!config.items.length ? (
            <div className="empty-dashboard">
              <span className="empty-symbol">
                <LayoutGrid size={36} />
              </span>
              <p className="eyebrow">A LITTLE SPACE FOR EVERYTHING</p>
              <h2>Make yourself at home.</h2>
              <p>
                Create your first pane and give your favourite apps
                <br />a place of their own.
              </p>
              <button className="primary" disabled={mobile} onClick={add}>
                <Plus size={17} />
                Create a pane
              </button>
              <button
                className="text-button"
                disabled={mobile}
                onClick={() => setEditor({ type: "settings" })}
              >
                Or import an existing layout <ArrowUpRight size={14} />
              </button>
              {mobile && (
                <small>Open on a wider desktop screen to get started.</small>
              )}
            </div>
          ) : (
            mounted &&
            (mobile ? (
              <div className="mobile-panes">
                {[...config.items]
                  .sort(
                    (a, b) =>
                      a.layout.y - b.layout.y || a.layout.x - b.layout.x,
                  )
                  .map((p) => (
                    <div key={p.id}>{paneContent(p)}</div>
                  ))}
              </div>
            ) : (
              <div className="grid-container" style={{ width }}>
                <GridLayout
                  width={width}
                  layout={config.items.map((p) => ({
                    i: p.id,
                    ...p.layout,
                    minW: minimum(
                      p,
                      config.dashboard.width,
                      config.appearance.appSize,
                    ).w,
                    minH: minimum(
                      p,
                      config.dashboard.width,
                      config.appearance.appSize,
                    ).h,
                  }))}
                  compactor={compactor}
                  gridConfig={{
                    cols: 24,
                    rowHeight: 24,
                    margin: [8, 8],
                    containerPadding: [0, 0],
                    maxRows: 256,
                  }}
                  dragConfig={{
                    enabled: editing,
                    handle: ".pane-drag",
                    cancel: ".pane-controls",
                    bounded: false,
                  }}
                  resizeConfig={{ enabled: editing, handles: ["e", "s", "se"] }}
                  onDragStop={updateLayout}
                  onResizeStop={updateLayout}
                >
                  {config.items.map((p) => (
                    <div key={p.id}>{paneContent(p)}</div>
                  ))}
                </GridLayout>
              </div>
            ))
          )}
        </div>
        {mobile && config.items.length > 0 && (
          <p className="mobile-note">
            Read-only presentation · Your desktop layout is preserved
          </p>
        )}
      </main>
      <footer>
        <span className="footer-mark">pane.</span>
        <span>A place for your digital world.</span>
        <span className="local-dot">Self-hosted · Yours</span>
      </footer>
      {editor?.type === "settings" && (
        <Settings
          config={config}
          apply={apply}
          imported={(c, id) => {
            apply(c);
            setEdit(true);
            setSelected(id || "");
          }}
          close={() => setEditor(null)}
          readOnly={mobile}
        />
      )}
      {editor?.type === "pane" && editing && (
        <PaneEditor
          config={config}
          pane={
            config.items.find((p) => p.id === editor.pane.id) || editor.pane
          }
          apply={apply}
          close={() => setEditor(null)}
        />
      )}
      {editor?.type === "app" && editing && (
        <AppEditor
          config={config}
          {...editor}
          apply={apply}
          close={() => setEditor(null)}
        />
      )}
    </div>
  );
}
