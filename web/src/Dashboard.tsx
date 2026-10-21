import { ThemeSurface, DropdownMenu, Notice } from "./design/components";
import { useConfirmation } from "./design/components";
import { Button } from "./design/components";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import {
  absoluteStrategy,
  getCompactor,
  defaultConstraints,
} from "react-grid-layout/core";
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
import {
  App,
  Config,
  Pane,
  canPresent,
  clone,
  duplicateSpace,
  getSpace,
  minimum,
  moveApp,
  newPane,
  resolvePaneApps,
  spaceNameKey,
  tileSize,
  frame,
  slotsFromFrame,
  uid,
  updateSpace,
  GRID,
  MAX_ROWS,
  MAX_SPACES,
  SNAP,
} from "./model";
import { tileResize, gridWidth, paneSnap } from "./layout";
import { HeaderBrand } from "./BrandLogo";
import Background from "./Background";
import { appearanceStyle, normaliseGlass, uiFontFamily } from "./appearance";
import PaneTitle from "./PaneTitle";
import { warmIconCatalogue } from "./features/apps/appCatalogue";
import { CatalogueIconImg } from "./features/apps/CatalogueIconImg";
import { useConfig } from "./useConfig";
import { AppEditor } from "./features/apps/AppEditor";
import { PaneEditor } from "./features/panes/PaneEditor";
import Settings from "./features/settings/Settings";
import { SpacesStrip } from "./features/spaces/SpacesStrip";
import { ManageSpaces } from "./features/spaces/ManageSpaces";
import {
  readRememberedSpace,
  resolveActiveSpace,
  writeRememberedSpace,
} from "./features/spaces/spacePrefs";
import GlassPaneLayers from "./GlassPaneLayers";
import { useGlassQuality } from "./useGlassQuality";
import { flushPendingRecentWallpaper, reconcileRecentWallpapers } from "./wallpaperRecent";
const compactor = getCompactor(null, false, true);
type Editor =
  | { type: "app"; spaceId: string; paneId: string; app?: App; col: number; row: number }
  | { type: "pane"; spaceId: string; pane: Pane }
  | { type: "settings" }
  | { type: "spaces" }
  | null;
function Artwork({ app }: { app: App }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [app.icon]);
  return (
    <span className="artwork">
      {app.icon && !broken ? (
        <CatalogueIconImg
          icon={app.icon}
          draggable={false}
          loading="eager"
          onExhausted={() => setBroken(true)}
        />
      ) : (
        <span>{app.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
export default function Dashboard() {
  const state = useConfig({
    onSaved: (saved) => {
      flushPendingRecentWallpaper(saved.appearance.background);
      reconcileRecentWallpapers(saved.appearance.background?.library ?? []);
    },
  });
  if (!state.config)
    return (
      <main className="loading" aria-busy={!state.error || undefined}>
        {state.error ? (
          <Notice tone="error" banner>
            <span>{state.error}</span>
            <div className="ui-actions">
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </Notice>
        ) : null}
      </main>
    );
  return <DashboardView {...state} config={state.config} />;
}
function DashboardView({
  config,
  change,
  commitSettings,
  discardSettings,
  status,
  error,
  retry,
}: ReturnType<typeof useConfig> & { config: Config }) {
  const { confirm, confirmation } = useConfirmation();
const { width: availableWidth, containerRef, mounted } = useContainerWidth();
  const [edit, setEdit] = useState(false),
    [editor, setEditor] = useState<Editor>(null),
    [addMenu, setAddMenu] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(""),
    [dragged, setDragged] = useState<string | null>(null);
  const [preview, setPreview] = useState<Layout | null>(null);
  const [settingsPreview, setSettingsPreview] = useState<Config | null>(null);
  const [glassInteracting, setGlassInteracting] = useState(false);
  const [glassVisible, setGlassVisible] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeSpaceId, setActiveSpaceId] = useState(() =>
    resolveActiveSpace(
      config.spaces,
      readRememberedSpace(config.dashboardId),
      config.defaultSpaceId,
    ),
  );
  const [scrollBySpace] = useState(() => new Map<string, number>());
  useEffect(() => {
    void warmIconCatalogue();
  }, []);
  useEffect(() => {
    const next = resolveActiveSpace(
      config.spaces,
      activeSpaceId,
      config.defaultSpaceId,
    );
    if (next !== activeSpaceId) setActiveSpaceId(next);
  }, [config.spaces, config.defaultSpaceId, activeSpaceId]);
  const display = settingsPreview ?? config;
  const spaceId = resolveActiveSpace(
    display.spaces,
    activeSpaceId,
    display.defaultSpaceId,
  );
  const spaceItems = getSpace(display, spaceId).items;
  const requestSpaceSwitch = (id: string) => {
    if (id === spaceId) return;
    if (glassInteracting || dragged) return;
    scrollBySpace.set(spaceId, window.scrollY);
    setActiveSpaceId(id);
    writeRememberedSpace(config.dashboardId, id);
    setSelected("");
    setDragged(null);
    setPreview(null);
    setGlassVisible(new Set());
    requestAnimationFrame(() => {
      const y = scrollBySpace.get(id) ?? 0;
      window.scrollTo(0, y);
    });
  };
  const createSpace = (duplicate: boolean) => {
    attempt(() => {
      if (config.spaces.length >= MAX_SPACES)
        throw Error(`At most ${MAX_SPACES} spaces are supported.`);
      const n = clone(config);
      let name = duplicate ? `${getSpace(n, spaceId).name} copy` : "New space";
      let i = 2;
      while (n.spaces.some((s) => spaceNameKey(s.name) === spaceNameKey(name))) {
        name = duplicate
          ? `${getSpace(config, spaceId).name} copy ${i++}`
          : `New space ${i++}`;
      }
      const space = duplicate
        ? duplicateSpace(getSpace(n, spaceId), name)
        : { id: uid(), name, items: [] };
      n.spaces.push(space);
      apply(n);
      requestSpaceSwitch(space.id);
      setEdit(true);
    });
  };
  const glass = normaliseGlass(display.appearance.glass ?? { mode: "solid", opacity: 15, blur: 2 });
  const glassMode = glass.mode === "glass";
  const onGlassVisible = useCallback((id: string, visible: boolean) => {
    setGlassVisible((prev) => {
      const has = prev.has(id);
      if (visible === has) return prev;
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const glassRefract = useGlassQuality({
    glassMode,
    visibleCount: glassVisible.size,
    interacting: glassInteracting,
  });
  const width = gridWidth(
    display.dashboard.widthMode === "full"
      ? availableWidth
      : display.dashboard.width,
  );
  const mobile =
    !!config &&
    ((display.dashboard.widthMode === "fixed" && availableWidth < width) ||
      availableWidth < 768 ||
      !canPresent(config, width, spaceId));
  const editing = edit && !mobile && status !== "Conflict";
  useEffect(() => {
    if (mobile) {
      setEdit(false);
      setEditor(current => current?.type === "settings" ? current : null);
      setAddMenu(false);
    }
  }, [mobile]);
  useEffect(() => {
    document.documentElement.dataset.theme = display.appearance.theme;
    document.documentElement.style.setProperty(
      "--ui-font",
      uiFontFamily(display.appearance.fontFamily),
    );
    document.title = display.dashboard.title.trim() || "pane.";
  }, [
    display.appearance.theme,
    display.appearance.fontFamily,
    display.dashboard.title,
  ]);
  const apply = (next: Config) => {
    if (
      config.dashboard.widthMode === "full" &&
      next.dashboard.widthMode === "full"
    )
      next = {
        ...next,
        dashboard: {
          ...next.dashboard,
          width: Math.max(next.dashboard.width, width),
        },
      };
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
  const labels = display.appearance.showButtonLabels,
    size = tileSize;
  const add = () =>
    attempt(() => {
      const n = clone(config);
      if (n.dashboard.widthMode === "full") n.dashboard.width = width;
      const space = getSpace(n, spaceId);
      const pane = newPane(space.items, n.dashboard.width);
      apply(
        updateSpace(n, spaceId, (s) => ({
          ...s,
          items: [...s.items, pane],
        })),
      );
      setEdit(true);
      setSelected(pane.id);
      setAddMenu(false);
    });
  const updateLayout = (layout: Layout) => {
    setPreview(null);
    if (!editing) return;
    attempt(() => {
      const next = updateSpace(config, spaceId, (space) => {
        const items = space.items.map((p) => {
          const l = layout.find((x) => x.i === p.id);
          if (!l) return p;
          return {
            ...p,
            layout: slotsFromFrame({ x: l.x, y: l.y, w: l.w, h: l.h }),
          };
        });
        return { ...space, items };
      });
      if (JSON.stringify(next) !== JSON.stringify(config)) apply(next);
    });
  };
  const openApp = (p: Pane, a: App) =>
    setEditor({
      type: "app",
      spaceId,
      paneId: p.id,
      app: a,
      col: a.col,
      row: a.row,
    });
  const tile = (p: Pane, a: App) => (
    <div
      key={a.placementId}
      className="app-tile"
      style={mobile ? undefined : { gridColumn: a.col + 1, gridRow: a.row + 1 }}
      draggable={editing}
      onDragStart={(e) => {
        if (!editing) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        setDragged(a.placementId);
        e.dataTransfer.setData("text/plain", a.placementId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragged(null)}
    >
      {editing ? (
        <Button variant="surface"
          className="app-link"
          aria-label={`Edit ${a.name}`}
          onClick={() => openApp(p, a)}
          title={`Edit ${a.name}`}
        >
          <Artwork app={a} />
          {display.appearance.showAppLabels && (
            <span className="app-name">{a.name}</span>
          )}
        </Button>
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
          {display.appearance.showAppLabels && (
            <span className="app-name">{a.name}</span>
          )}
        </a>
      )}
    </div>
  );
  const paneContent = (p: Pane) => {
    const live = preview?.find((l) => l.i === p.id);
    const cap = live ? slotsFromFrame(live) : p.layout;
    return (
      <section
        className={`pane-frame ${selected === p.id && editing ? "focused" : ""}`}
        aria-label={p.title || "Untitled pane"}
        onPointerDown={() => {
          if (editing) setSelected(p.id);
        }}
        onFocusCapture={() => {
          if (editing) setSelected(p.id);
        }}
      >
        <div className={`pane-header ${editing ? "pane-header-editing" : ""}`}>
          {editing && (
            <Button variant="surface"
              className="icon-button pane-move"
              aria-label={`Move ${p.title || "untitled pane"}`}
              title="Drag to move; arrow keys nudge"
              onKeyDown={(e) => {
                const delta: Record<string, [number, number]> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                if (!delta[e.key]) return;
                e.preventDefault();
                attempt(() => {
                  apply(
                    updateSpace(config, spaceId, (space) => ({
                      ...space,
                      items: space.items.map((x) => {
                        if (x.id !== p.id) return x;
                        const [dx, dy] = delta[e.key];
                        // Move to the next 16px line, including older half-grid positions.
                        const nudge = (v: number, d: number) =>
                          d > 0
                            ? (Math.floor(v / SNAP) + 1) * SNAP
                            : (Math.ceil(v / SNAP) - 1) * SNAP;
                        const layout = { ...x.layout };
                        if (dx) layout.x = nudge(layout.x, dx);
                        if (dy) layout.y = nudge(layout.y, dy);
                        return { ...x, layout };
                      }),
                    })),
                  );
                });
              }}
            >
              <Grip size={18} />
            </Button>
          )}
          <PaneTitle
            title={p.title}
            editable={editing}
            save={(title) =>
              attempt(() =>
                apply(
                  updateSpace(config, spaceId, (space) => ({
                    ...space,
                    items: space.items.map((x) =>
                      x.id === p.id ? { ...x, title } : x,
                    ),
                  })),
                ),
              )
            }
          />
          {editing && (
            <Button variant="surface"
              className="icon-button pane-controls"
              aria-label={`Edit ${p.title || "untitled pane"}`}
              onClick={() => setEditor({ type: "pane", spaceId, pane: p })}
            >
              <Ellipsis size={20} />
            </Button>
          )}
        </div>
        <div className="pane">
          {glassMode && (
            <GlassPaneLayers
              paneId={p.id}
              onVisibleChange={onGlassVisible}
              refract={glassRefract}
              displacement={glass.displacement}
              aberration={glass.aberration}
            />
          )}
          <div
            className={`app-grid ${mobile ? "mobile-apps" : ""}`}
            style={
              mobile
                ? undefined
                : {
                    gridTemplateColumns: `repeat(${cap.w}, ${size.w}px)`,
                    gridAutoRows: `${size.h}px`,
                  }
            }
          >
            {editing &&
              Array.from({ length: cap.w * cap.h }, (_, i) => {
                const col = i % cap.w,
                  row = Math.floor(i / cap.w);
                if (p.apps.some((a) => a.col === col && a.row === row))
                  return null;
                return (
                  <Button variant="surface"
                    key={`slot-${i}`}
                    className={`empty-slot ${dragged ? "drop-ready" : ""}`}
                    aria-label={`Add app at column ${col + 1}, row ${row + 1}`}
                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                    onClick={() =>
                      setEditor({ type: "app", spaceId, paneId: p.id, col, row })
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
                          apply(moveApp(config, spaceId, dragged, p.id, col, row)),
                        );
                      setDragged(null);
                    }}
                  >
                    <span className="placeholder-artwork">
                      <Plus size={20} />
                    </span>
                  </Button>
                );
              })}
            {resolvePaneApps(display, p)
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((a) => tile(p, a))}
          </div>
        </div>
      </section>
    );
  };
  return (
    <ThemeSurface theme={display.appearance.theme}
      className="shell"
      data-pane-style={display.appearance.glass?.mode ?? "solid"}
      style={
        {
          ...appearanceStyle(display.appearance),
          "--icon-size": `${size.icon}px`,
          "--cell-width": `${size.w}px`,
          "--cell-height": `${size.h}px`,
          "--pane-title-size": `${display.appearance.paneTitleSize ?? 18}px`,
        } as CSSProperties
      }
    >
      {confirmation}
      <Background
        settings={display.appearance.background}
        theme={display.appearance.theme}
      />
      <header className="topbar">
        <a
          href="#"
          className="brand"
          aria-label={`${display.dashboard.title.trim() || "pane."} home`}
        >
          <HeaderBrand dashboard={display.dashboard} />
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
            <DropdownMenu open={addMenu} onOpenChange={setAddMenu} trigger={<Button variant="surface"
                className="nav-button"
                disabled={mobile || status === "Conflict"}
                title="Add"
                aria-label="Add"
                aria-expanded={addMenu}
              >
                <span>
                  <Plus size={21} />
                </span>
                {labels && <small>Add</small>}
              </Button>} items={[
              {label: "Add pane", icon: <LayoutGrid size={16} aria-hidden="true" />, onSelect: add},
              {label: "Widget — coming later", disabled: true},
              {label: "Close menu", onSelect: () => setAddMenu(false)},
            ]} />
            <Button variant="surface"
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
            </Button>
            <Button variant="surface"
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
            </Button>
          </div>
        </div>
      </header>
      <SpacesStrip
        spaces={display.spaces}
        activeId={spaceId}
        editing={editing}
        onSelect={requestSpaceSwitch}
        onNew={() => createSpace(false)}
        onManage={() => setEditor({ type: "spaces" })}
      />
      <main>
        {(error || message) && (
          <Notice tone="error" banner>
            <span>{message || error}</span>
            <div className="ui-actions">
              {error && (
                <Button
                  onClick={async () =>
                    status === "Conflict"
                      ? await confirm({
                          title: "Reload dashboard?",
                          description: "Reload and discard unsaved changes from this session?",
                          cancelLabel: "Cancel",
                          actionLabel: "Reload",
                        }) && window.location.reload()
                      : retry()
                  }
                >
                  {status === "Conflict" ? "Reload" : "Retry save"}
                </Button>
              )}
              {message && <Button onClick={() => setMessage("")}>Dismiss</Button>}
            </div>
          </Notice>
        )}
        <div
          ref={containerRef}
          className={`workspace ${editing ? "editing-grid" : ""}`}
        >
          {!spaceItems.length ? (
            <div className="empty-dashboard">
              <span className="empty-symbol">
                <LayoutGrid size={36} />
              </span>
              <h2>No panes yet</h2>
              <p>Add a pane or import a layout to get started.</p>
              <Button variant="primary" disabled={mobile} onClick={add}>
                <Plus size={17} />
                Create a pane
              </Button>
              <Button variant="surface"
                className="text-button"
                disabled={mobile}
                onClick={() => setEditor({ type: "settings" })}
              >
                Or import an existing layout <ArrowUpRight size={14} />
              </Button>
              {mobile && (
                <small>Open on a wider desktop screen to get started.</small>
              )}
            </div>
          ) : (
            mounted &&
            (mobile ? (
              <div className="mobile-panes">
                {[...spaceItems]
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
                  // top/left — CSS transforms on grid items isolate backdrop-filter
                  // from the page background, so glass frost/refraction cannot sample it.
                  positionStrategy={absoluteStrategy}
                  layout={spaceItems.map((p) => ({
                    i: p.id,
                    ...frame(p.layout),
                    minW: frame({ ...p.layout, ...minimum(p) }).w,
                    minH: frame({ ...p.layout, ...minimum(p) }).h,
                  }))}
                  compactor={compactor}
                  constraints={[...defaultConstraints, paneSnap, tileResize]}
                  gridConfig={{
                    cols: width / GRID,
                    rowHeight: GRID,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    maxRows: MAX_ROWS,
                  }}
                  dragConfig={{
                    enabled: editing,
                    handle: ".pane-move",
                    cancel: ".pane-controls",
                    bounded: false,
                  }}
                  resizeConfig={{ enabled: editing, handles: ["e", "s", "se"] }}
                  onDragStop={(layout) => {
                    setGlassInteracting(false);
                    updateLayout(layout);
                  }}
                  onDragStart={(_layout, _old, item) => {
                    setGlassInteracting(true);
                    if (item) setSelected(item.i);
                  }}
                  onResizeStart={(_layout, _old, item) => {
                    setGlassInteracting(true);
                    if (item) setSelected(item.i);
                  }}
                  onResize={(layout) => setPreview(layout)}
                  onResizeStop={(layout) => {
                    setGlassInteracting(false);
                    updateLayout(layout);
                  }}
                >
                  {spaceItems.map((p) => (
                    <div
                      key={p.id}
                      className={`pane-grid-item ${editing && selected === p.id ? "is-selected" : ""}`}
                      style={
                        {
                          "--pane-frame-width": `${(preview?.find((l) => l.i === p.id)?.w ?? frame(p.layout).w) * GRID}px`,
                          "--pane-frame-height": `${(preview?.find((l) => l.i === p.id)?.h ?? frame(p.layout).h) * GRID}px`,
                        } as CSSProperties
                      }
                    >
                      {paneContent(p)}
                    </div>
                  ))}
                </GridLayout>
              </div>
            ))
          )}
        </div>
        {mobile && spaceItems.length > 0 && (
          <p className="mobile-note">
            Read-only presentation · Your desktop layout is preserved
          </p>
        )}
      </main>
      {editor?.type === "settings" && (
        <Settings
          config={config}
          commitSettings={commitSettings}
          discardSettings={discardSettings}
          imported={(c, id) => {
            apply(c);
            setEdit(true);
            setSelected(id || "");
          }}
          onPreview={setSettingsPreview}
          close={() => {
            setSettingsPreview(null);
            setEditor(null);
          }}
          readOnly={availableWidth < 768 || (config.dashboard.widthMode === "fixed" && availableWidth < config.dashboard.width) || !canPresent(config, gridWidth(config.dashboard.widthMode === "full" ? availableWidth : config.dashboard.width))}
          activeSpaceId={spaceId}
        />
      )}
      {editor?.type === "pane" && editing && (
        <PaneEditor
          config={config}
          spaceId={editor.spaceId}
          pane={
            getSpace(config, editor.spaceId).items.find((p) => p.id === editor.pane.id) ||
            editor.pane
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
      {editor?.type === "spaces" && editing && (
        <ManageSpaces
          config={config}
          activeSpaceId={spaceId}
          apply={apply}
          onSelect={requestSpaceSwitch}
          close={() => setEditor(null)}
        />
      )}
    </ThemeSurface>
  );
}

