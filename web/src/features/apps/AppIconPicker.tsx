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
} from "../../design/components";
import {
  appendRevealCount,
  catalogueEntryForIcon,
  ensureCatalogue,
  getActiveCatalogue,
  initialRevealCount,
  orderCatalogueEntries,
  popularCatalogueEntries,
  refreshCatalogueIfStale,
  resolveArtworkSlug,
  type CatalogueEntry,
  type IconVariant,
} from "./appCatalogue";
import { CatalogueIconImg } from "./CatalogueIconImg";

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 3;
const MIN_TILE_HEIGHT = 56;

const VARIANT_OPTIONS: { value: IconVariant; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export type CatalogueSelection = {
  entry: CatalogueEntry;
  artworkSlug: string;
};

export type AppIconPickerProps = {
  selectedIcon: string;
  onSelect: (selection: CatalogueSelection) => void;
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
  artworkSlug,
  failed,
  onFailed,
}: {
  entry: CatalogueEntry;
  artworkSlug: string;
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
    <CatalogueIconImg
      icon={`dashboard-icons:${artworkSlug}`}
      width={40}
      height={40}
      loading="lazy"
      onExhausted={onFailed}
    />
  );
}

export function AppIconPicker({
  selectedIcon,
  onSelect,
  detailsTargetId,
  autoFocusSearch = false,
  entries: entriesProp,
}: AppIconPickerProps) {
  const [query, setQuery] = useState("");
  const [variant, setVariant] = useState<IconVariant>("default");
  const [visibleCount, setVisibleCount] = useState(0);
  const [failedSlugs, setFailedSlugs] = useState<Record<string, true>>({});
  const [loadedEntries, setLoadedEntries] = useState<readonly CatalogueEntry[]>(
    () => getActiveCatalogue(),
  );
  const [catalogueLoading, setCatalogueLoading] = useState(
    () => !entriesProp && getActiveCatalogue() === popularCatalogueEntries,
  );
  const [catalogueError, setCatalogueError] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryGen = useRef(0);
  const appending = useRef(false);
  const prevVariant = useRef(variant);
  const entries = entriesProp ?? loadedEntries;
  const matches = useMemo(
    () => orderCatalogueEntries(entries, query),
    [entries, query],
  );

  useEffect(() => {
    if (entriesProp) {
      setCatalogueLoading(false);
      setCatalogueError(false);
      return;
    }
    let cancelled = false;
    setCatalogueLoading(getActiveCatalogue() === popularCatalogueEntries);
    setCatalogueError(false);
    void ensureCatalogue()
      .then((full) => {
        if (cancelled) return;
        setLoadedEntries(full);
        setCatalogueLoading(false);
        void refreshCatalogueIfStale().then((refreshed) => {
          if (cancelled || !refreshed) return;
          setLoadedEntries(refreshed);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedEntries(getActiveCatalogue());
        setCatalogueLoading(false);
        setCatalogueError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entriesProp]);
  const rendered = matches.slice(0, visibleCount);
  const exhausted = matches.length === 0 || visibleCount >= matches.length;
  const selectedEntry = catalogueEntryForIcon(selectedIcon, entries);
  const selectedArtworkSlug = selectedEntry
    ? selectedIcon.startsWith("dashboard-icons:")
      ? selectedIcon.slice("dashboard-icons:".length)
      : selectedEntry.slug
    : "";

  const emitSelection = (entry: CatalogueEntry, nextVariant: IconVariant) => {
    onSelect({
      entry,
      artworkSlug: resolveArtworkSlug(entry, nextVariant),
    });
  };

  useEffect(() => {
    if (prevVariant.current === variant) return;
    prevVariant.current = variant;
    const current = catalogueEntryForIcon(selectedIcon, entries);
    if (!current) return;
    onSelect({
      entry: current,
      artworkSlug: resolveArtworkSlug(current, variant),
    });
  }, [variant, selectedIcon, entries, onSelect]);

  const fillBuffer = (gen: number) => {
    if (gen !== queryGen.current) return;
    const viewport = viewportRef.current;
    const grid = gridRef.current;
    const columns = measureColumns(grid);
    const rows = measureRowsPerViewport(viewport, grid);
    setVisibleCount((current) => {
      if (gen !== queryGen.current) return current;
      const target = initialRevealCount(matches.length, columns, rows);
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
              {failedSlugs[selectedArtworkSlug] ? (
                <span className="ui-icon-picker-fallback">
                  {selectedEntry.displayName.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <CatalogueIconImg
                  icon={`dashboard-icons:${selectedArtworkSlug}`}
                  width={40}
                  height={40}
                  loading="eager"
                  onExhausted={() =>
                    setFailedSlugs((prev) => ({
                      ...prev,
                      [selectedArtworkSlug]: true,
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
        <div
          className="ui-icon-picker-variants"
          role="radiogroup"
          aria-label="Icon variant"
        >
          {VARIANT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="quiet"
              className={`ui-icon-picker-variant${variant === option.value ? " selected" : ""}`}
              role="radio"
              aria-checked={variant === option.value}
              onClick={() => setVariant(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="quiet"
          className="ui-icon-picker-skip"
          onClick={skipToDetails}
        >
          Skip to app details
        </Button>
      </div>
      {catalogueLoading ? (
        <Text
          as="p"
          variant="caption"
          className="ui-icon-picker-catalogue-status"
          role="status"
        >
          Loading full catalogue…
        </Text>
      ) : null}
      {catalogueError ? (
        <Text
          as="p"
          variant="caption"
          className="ui-icon-picker-catalogue-status"
          role="status"
        >
          Showing popular apps only. Full catalogue could not be loaded.
        </Text>
      ) : null}
      <ScrollArea
        className="ui-icon-picker-scroll"
        viewportRef={viewportRef}
        aria-label="App catalogue"
      >
        {matches.length === 0 ? (
          <Text as="p" variant="support" className="ui-icon-picker-empty">
            {catalogueLoading
              ? "Loading more apps…"
              : "No apps found. Try another name or use a custom icon."}
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
                const artworkSlug = resolveArtworkSlug(entry, variant);
                const selected = selectedEntry?.slug === entry.slug;
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
                    onClick={() => emitSelection(entry, variant)}
                  >
                    <span className="ui-icon-picker-art">
                      <TileArtwork
                        entry={entry}
                        artworkSlug={artworkSlug}
                        failed={Boolean(failedSlugs[artworkSlug])}
                        onFailed={() =>
                          setFailedSlugs((prev) => ({
                            ...prev,
                            [artworkSlug]: true,
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
