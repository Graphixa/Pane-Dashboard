import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Play, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ColourPopoverFields,
  IconButton,
  Popover,
  PopoverHead,
  Text,
  useDeferredColour,
} from "./design/components";
import { solidBackgroundPaint } from "./appearance";

export type MediaKind = "image" | "video";

/** Stable partition: static items first, then live/video; preserve relative order in each group. */
export function sortStaticBeforeLive<T>(
  items: readonly T[],
  kindOf: (item: T) => MediaKind,
): T[] {
  const staticItems: T[] = [];
  const liveItems: T[] = [];
  for (const item of items) {
    if (kindOf(item) === "video") liveItems.push(item);
    else staticItems.push(item);
  }
  return staticItems.concat(liveItems);
}

export function chipInk(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#ffffff";
  const y = ((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114;
  return y > 160000 ? "#1a222e" : "#ffffff";
}

/** Live-paint the solid wallpaper base while the custom chip is dragged. */
export function paintSolidWallpaper(hex: string) {
  const paint = solidBackgroundPaint(hex);
  document.querySelectorAll<HTMLElement>(".scene, .scene-base").forEach((node) => {
    node.style.background = paint;
  });
}

export function WallpaperColourChip({
  name,
  colour,
  pressed,
  onSelect,
}: {
  name: string;
  colour: string;
  pressed: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="wallpaper-colour-chip"
      aria-label={name}
      title={name}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <span
        className="wallpaper-colour-chip-paint"
        style={{ background: colour, color: chipInk(colour) }}
        aria-hidden="true"
      >
        {pressed ? <Check size={16} strokeWidth={2.75} /> : null}
      </span>
    </Button>
  );
}

export function WallpaperCustomColour({
  colour,
  pressed,
  onColour,
}: {
  colour: string;
  pressed: boolean;
  onColour: (colour: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { live, hex, setHex, noteInput, applyHex, flush } = useDeferredColour({
    colour,
    onColour,
    paintLive: paintSolidWallpaper,
  });
  const picking = open && live.toLowerCase() !== colour.toLowerCase();
  const filled = pressed || picking;
  return (
    <Popover
      label="Custom colour"
      open={open}
      onOpenChange={(next) => {
        if (!next) flush();
        setOpen(next);
      }}
      trigger={
        <Button
          variant="surface"
          type="button"
          className={`wallpaper-colour-chip wallpaper-colour-chip-add${picking ? " wallpaper-colour-chip-picking" : ""}${filled ? " wallpaper-colour-chip-filled" : ""}`}
          aria-label="Custom colour"
          title="Custom colour"
          aria-pressed={pressed}
        >
          <span
            className="wallpaper-colour-chip-paint"
            style={filled ? { background: live, color: chipInk(live) } : undefined}
            aria-hidden="true"
          >
            {pressed && !open ? (
              <Check size={16} strokeWidth={2.75} />
            ) : (
              <Plus size={16} />
            )}
          </span>
        </Button>
      }
    >
      <PopoverHead
        title="Custom colour"
        closeLabel="Close Custom colour picker"
        onClose={() => {
          flush();
          setOpen(false);
        }}
      />
      <ColourPopoverFields
        pickerLabel="Custom colour"
        swatchValue={/^#[0-9a-f]{6}$/.test(live) ? live : "#a2cbbb"}
        hex={hex}
        onHexChange={setHex}
        onSwatchChange={noteInput}
        onHexCommit={applyHex}
      />
    </Popover>
  );
}

/** At most one chooser thumb plays hover/focus preview at a time. */
let activeThumbVideo: HTMLVideoElement | null = null;

function releaseThumbVideo(el: HTMLVideoElement | null) {
  if (!el) return;
  el.pause();
  try {
    el.currentTime = 0;
  } catch {
    /* seek may fail before ready */
  }
  if (activeThumbVideo === el) activeThumbVideo = null;
}

function claimThumbVideo(el: HTMLVideoElement) {
  if (activeThumbVideo && activeThumbVideo !== el) {
    releaseThumbVideo(activeThumbVideo);
  }
  activeThumbVideo = el;
  el.muted = true;
  const play = el.play();
  if (play && typeof play.catch === "function") {
    play.catch(() => {
      /* autoplay policy / decode — stay on still */
    });
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function LiveThumbVideo({
  videoSrc,
  poster,
  active,
}: {
  videoSrc: string;
  poster?: string;
  active: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) claimThumbVideo(v);
    else releaseThumbVideo(v);
    return () => releaseThumbVideo(v);
  }, [active, videoSrc]);

  return (
    <video
      ref={ref}
      className="wallpaper-tile-video"
      src={videoSrc}
      poster={poster}
      muted
      playsInline
      loop
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      onLoadedData={(event) => {
        const v = event.currentTarget;
        if (active) return;
        // Nudge past 0 so browsers paint a decodeable still when no poster exists.
        if (!poster) {
          try {
            if (v.currentTime < 0.05) v.currentTime = 0.05;
          } catch {
            /* ignore */
          }
        }
        v.pause();
      }}
    />
  );
}

export function WallpaperTile({
  label,
  pressed,
  kind = "image",
  paint,
  src,
  videoSrc,
  onSelect,
  onRemove,
}: {
  label: string;
  pressed: boolean;
  kind?: MediaKind;
  paint?: string;
  /** Still image URL (photo tile, or live poster when available). */
  src?: string;
  /** Video file URL for live tiles (hover/focus preview). */
  videoSrc?: string;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const live = kind === "video";
  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const tileId = useId();
  const playPreview =
    live && Boolean(videoSrc) && !reducedMotion && (hover || focus);
  const a11y = `${label}${live ? ", live wallpaper" : ""}`;

  return (
    <div
      className="wallpaper-tile-wrap"
      data-tile-id={tileId}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Button
        variant="surface"
        type="button"
        className={`wallpaper-tile${pressed ? " wallpaper-tile-selected" : ""}`}
        aria-label={a11y}
        title={label}
        aria-pressed={pressed}
        onClick={onSelect}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      >
        <div className="ui-aspect-ratio wallpaper-tile-frame">
          {paint ? (
            <span className="wallpaper-tile-paint" style={{ background: paint }} />
          ) : live && videoSrc ? (
            <LiveThumbVideo
              videoSrc={videoSrc}
              poster={src}
              active={playPreview}
            />
          ) : (
            <span
              className="wallpaper-tile-paint wallpaper-tile-image"
              style={src ? { backgroundImage: `url(${src})` } : undefined}
            />
          )}
        </div>
        {live ? (
          <span className="wallpaper-tile-video-badge" aria-hidden="true">
            <span>Live</span>
            <Play size={10} strokeWidth={2.5} fill="currentColor" />
          </span>
        ) : null}
        {pressed ? (
          <span className="wallpaper-tile-check" aria-hidden="true">
            <Check size={14} strokeWidth={2.75} />
          </span>
        ) : null}
      </Button>
      {onRemove ? (
        <IconButton
          variant="quiet"
          type="button"
          className="wallpaper-tile-remove"
          label={`Remove ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}

export function WallpaperCategoryCard({
  name,
  coverSrc,
  paint,
  empty,
  onSelect,
}: {
  name: string;
  coverSrc?: string;
  /** CSS background (e.g. gradient) when there is no image cover. */
  paint?: string;
  empty?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="surface"
      type="button"
      className="wallpaper-category-card"
      aria-label={name}
      data-category-card={name}
      onClick={onSelect}
    >
      <span
        className={`wallpaper-category-cover${empty && !paint ? " wallpaper-category-cover-empty" : ""}`}
        style={
          paint
            ? { background: paint }
            : coverSrc && !empty
              ? { backgroundImage: `url(${coverSrc})` }
              : undefined
        }
        aria-hidden="true"
      />
      <span className="wallpaper-category-tint" aria-hidden="true" />
      <Text as="span" variant="label" className="wallpaper-category-name">
        {name}
      </Text>
    </Button>
  );
}

export function WallpaperSection({
  heading,
  label,
  children,
  compact = false,
}: {
  heading: string;
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`wallpaper-browse-section${compact ? " wallpaper-browse-section-compact" : ""}`}>
      <Text as="h3" variant="label" className="wallpaper-browse-heading">
        {heading}
      </Text>
      <div className="wallpaper-browse-section-body" role="group" aria-label={label}>
        {children}
      </div>
    </section>
  );
}
