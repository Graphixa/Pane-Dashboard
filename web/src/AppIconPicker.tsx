import { Check } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  ScrollArea,
  Text,
  TextField,
} from "./design/components";
import {
  appendRevealCount,
  catalogueEntries,
  filterCatalogueEntries,
  iconURL,
  initialRevealCount,
  type CatalogueEntry,
} from "./icons";

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 3;
const MIN_TILE_HEIGHT = 56;

export type AppIconPickerProps = {
  selectedIcon: string;
  onSelect: (entry: CatalogueEntry) => void;
  detailsTargetId: string;
  autoFocusSearch?: boolean;
  /** Optional catalogue override for tests (long synthetic lists). */
  entries?: readonly CatalogueEntry[];
};

function measureColumns(grid: HTMLElement | null): number {
  if (!grid) return DEFAULT_COLUMNS;
  const style = getComputedStyle(grid);
  const template = style.gridTemplateColumns;
  if (!template || template === "none") return DEFAULT_COLUMNS;
  const count = template.split(" ").filter(Boolean).length;
  return Math.max(1, count || DEFAULT_COLUMNS);
}

function measureRowsPerViewport(
  viewport: HTMLElement | null,
  grid: HTMLElement | null,
): number {
  if (!viewport) return DEFAULT_ROWS;
  const height = viewport.clientHeight;
  if (height <= 0) return DEFAULT_ROWS;
  const firstTile = grid?.querySelector<HTMLElement>(".ui-icon-picker-tile");
  const tileHeight = Math.max(
    MIN_TILE_HEIGHT,
    firstTile?.getBoundingClientRect().height ?? MIN_TILE_HEIGHT,
  );
  return Math.max(1, Math.ceil(height / tileHeight));
}

function TileArtwork({
  entry,
  failed,
  onFailed,
}: {
  entry: CatalogueEntry;
  failed: boolean;
  onFailed: () => void;
}) {
  if (failed) {
    return (
      <span className="ui-icon-picker-fallback" aria-hidden="true">
        {entry.displayName.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      loading="lazy"
      decoding="async"
      width={40}
      height={40}
      src={iconURL(`dashboard-icons:${entry.slug}`)}
      alt=""
      onError={onFailed}
    />
  );
}

export function AppIconPicker({
  selectedIcon,
  onSelect,
  detailsTargetId,
  autoFocusSearch = false,
  entries = catalogueEntries,
}: AppIconPickerProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const [failedSlugs, setFailedSlugs] = useState<Record<string, true>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryGen = useRef(0);
  const appending = useRef(false);
  const matches = useMemo(
    () => filterCatalogueEntries(entries, query),
    [entries, query],
  );
  const rendered = matches.slice(0, visibleCount);
  const exhausted = matches.length === 0 || visibleCount >= matches.length;
  const selectedSlug = selectedIcon.startsWith("dashboard-icons:")
    ? selectedIcon.slice("dashboard-icons:".length)
    : "";
  const selectedEntry = selectedSlug
    ? entries.find((entry) => entry.slug === selectedSlug)
    : undefined;

  const fillBuffer = (gen: number) => {
    if (gen !== queryGen.current) return;
    const viewport = viewportRef.current;
    const grid = gridRef.current;
    const columns = measureColumns(grid);
    const rows = measureRowsPerViewport(viewport, grid);
    setVisibleCount((current) => {
      if (gen !== queryGen.current) return current;
      const target = initialRevealCount(matches.length, columns, rows);
      // Keep filling while the buffer is short of the target (resize / empty first paint).
      return Math.max(current, target);
    });
  };

  const appendMore = (gen: number) => {
    if (gen !== queryGen.current || appending.current) return;
    appending.current = true;
    const columns = measureColumns(gridRef.current);
    const rows = measureRowsPerViewport(viewportRef.current, gridRef.current);
    setVisibleCount((current) => {
      if (gen !== queryGen.current) return current;
      return appendRevealCount(current, matches.length, columns, rows);
    });
    queueMicrotask(() => {
      appending.current = false;
    });
  };

  useLayoutEffect(() => {
    queryGen.current += 1;
    const gen = queryGen.current;
    appending.current = false;
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = 0;
    // Synchronous first paint (defaults), then refine once tiles exist.
    const columns = measureColumns(gridRef.current);
    const rows = measureRowsPerViewport(viewport, gridRef.current);
    setVisibleCount(initialRevealCount(matches.length, columns, rows));
    requestAnimationFrame(() => {
      fillBuffer(gen);
      requestAnimationFrame(() => fillBuffer(gen));
    });
  }, [query, entries, matches.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const sentinel = sentinelRef.current;
    if (!viewport || !sentinel || exhausted) return;
    const gen = queryGen.current;

    if (typeof IntersectionObserver === "undefined") {
      const onScrollOrResize = () => {
        if (gen !== queryGen.current) return;
        const margin = viewport.clientHeight;
        if (
          viewport.scrollTop + viewport.clientHeight + margin >=
          viewport.scrollHeight - 4
        ) {
          appendMore(gen);
        }
      };
      viewport.addEventListener("scroll", onScrollOrResize, { passive: true });
      window.addEventListener("resize", onScrollOrResize);
      onScrollOrResize();
      return () => {
        viewport.removeEventListener("scroll", onScrollOrResize);
        window.removeEventListener("resize", onScrollOrResize);
      };
    }

    const rootMargin = `${Math.max(48, viewport.clientHeight)}px`;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (gen !== queryGen.current) return;
        if (entry?.isIntersecting) appendMore(gen);
      },
      { root: viewport, rootMargin: `0px 0px ${rootMargin} 0px`, threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [exhausted, visibleCount, matches.length, query]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const gen = queryGen.current;
    const ro = new ResizeObserver(() => {
      if (gen !== queryGen.current) return;
      fillBuffer(queryGen.current);
    });
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [query, matches.length]);

  const skipToDetails = () => {
    const target = document.getElementById(detailsTargetId);
    target?.focus();
  };

  const ensureAheadOnFocus = (index: number) => {
    if (index < rendered.length - measureColumns(gridRef.current)) return;
    appendMore(queryGen.current);
  };

  return (
    <div className="ui-icon-picker">
      <TextField
        label="Search apps"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the local catalogue"
        autoComplete="off"
        autoFocus={autoFocusSearch}
      />
      <div className="ui-icon-picker-summary" aria-live="polite">
        {selectedEntry ? (
          <>
            <span className="ui-icon-picker-summary-art" aria-hidden="true">
              {failedSlugs[selectedEntry.slug] ? (
                <span className="ui-icon-picker-fallback">
                  {selectedEntry.displayName.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <img
                  width={40}
                  height={40}
                  src={iconURL(`dashboard-icons:${selectedEntry.slug}`)}
                  alt=""
                  onError={() =>
                    setFailedSlugs((prev) => ({
                      ...prev,
                      [selectedEntry.slug]: true,
                    }))
                  }
                />
              )}
            </span>
            <Text as="span" variant="label">
              {selectedEntry.displayName}
            </Text>
          </>
        ) : selectedIcon ? (
          <Text as="span" variant="support">
            Custom icon selected
          </Text>
        ) : (
          <Text as="span" variant="support">
            No app selected
          </Text>
        )}
      </div>
      <div className="ui-icon-picker-toolbar">
        <Button
          type="button"
          variant="quiet"
          className="ui-icon-picker-skip"
          onClick={skipToDetails}
        >
          Skip to app details
        </Button>
      </div>
      <ScrollArea
        className="ui-icon-picker-scroll"
        viewportRef={viewportRef}
        aria-label="App catalogue"
      >
        {matches.length === 0 ? (
          <Text as="p" variant="support" className="ui-icon-picker-empty">
            No apps found. Try another name or use a custom icon.
          </Text>
        ) : (
          <>
            <div
              ref={gridRef}
              className="ui-icon-picker-grid"
              role="group"
              aria-label="Matching apps"
            >
              {rendered.map((entry, index) => {
                const selected =
                  selectedIcon === `dashboard-icons:${entry.slug}`;
                return (
                  <Button
                    key={entry.slug}
                    type="button"
                    variant="surface"
                    className={`ui-icon-picker-tile${selected ? " selected" : ""}`}
                    title={entry.displayName}
                    aria-label={entry.displayName}
                    aria-pressed={selected}
                    onFocus={() => ensureAheadOnFocus(index)}
                    onClick={() => onSelect(entry)}
                  >
                    <span className="ui-icon-picker-art">
                      <TileArtwork
                        entry={entry}
                        failed={Boolean(failedSlugs[entry.slug])}
                        onFailed={() =>
                          setFailedSlugs((prev) => ({
                            ...prev,
                            [entry.slug]: true,
                          }))
                        }
                      />
                      {selected ? (
                        <span className="ui-icon-picker-check" aria-hidden="true">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </span>
                    <span>{entry.displayName}</span>
                  </Button>
                );
              })}
            </div>
            {!exhausted ? (
              <div
                ref={sentinelRef}
                className="ui-icon-picker-sentinel"
                aria-hidden="true"
              />
            ) : (
              <Text
                as="p"
                variant="caption"
                className="ui-icon-picker-end"
                role="status"
              >
                All matching apps shown
              </Text>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
