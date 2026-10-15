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
import { useVideoStill } from "./videoStillCache";

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
      /* stay on paused frame */
    });
  }
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Linger before mounting a hover preview so scrubbing stays cheap. */
export const LIVE_HOVER_PREVIEW_MS = 180;

/** Arm live preview: focus immediate; hover waits `LIVE_HOVER_PREVIEW_MS`. */
export function useLiveThumbArm({
  hover,
  focus,
  enabled,
}: {
  hover: boolean;
  focus: boolean;
  enabled: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!enabled || !(hover || focus)) {
      setArmed(false);
      return;
    }
    if (focus) {
      setArmed(true);
      return;
    }
    const timer = window.setTimeout(() => setArmed(true), LIVE_HOVER_PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [hover, focus, enabled]);
  return armed;
}

/**
 * Still while idle; `<video>` only when `active`. Thumb stays until playing
 * so the first video paint is never black. Shared by chooser tiles, Recently
 * used, and the Background Current preview.
 */
export function LiveThumbVideo({
  videoSrc,
  thumbSrc,
  active,
}: {
  videoSrc: string;
  thumbSrc?: string;
  active: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const captured = useVideoStill(thumbSrc ? undefined : videoSrc);
  const still = thumbSrc ?? captured;

  useEffect(() => {
    if (!active) setVideoReady(false);
  }, [active]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) claimThumbVideo(v);
    else releaseThumbVideo(v);
    return () => releaseThumbVideo(v);
  }, [active, videoSrc]);

  const showThumb = Boolean(still) && !(active && videoReady);

  return (
    <>
      {showThumb || !active ? <TileStill src={showThumb ? still : undefined} /> : null}
      {active ? (
        <video
          ref={ref}
          className="wallpaper-tile-video"
          src={videoSrc}
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setVideoReady(true)}
        />
      ) : null}
    </>
  );
}

function TileStill({ src }: { src?: string }) {
  if (!src) {
    return <span className="wallpaper-tile-paint" aria-hidden="true" />;
  }
  return (
    <img
      className="wallpaper-tile-paint wallpaper-tile-image"
      src={src}
      alt=""
      loading="eager"
      draggable={false}
      aria-hidden="true"
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
  /** Still / thumb image URL (photos, or live catalogue thumb). */
  src?: string;
  /** Video file URL for live tiles (loads on hover/focus when a thumb exists). */
  videoSrc?: string;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const live = kind === "video";
  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const tileId = useId();
  const playPreview = useLiveThumbArm({
    hover,
    focus,
    enabled: live && Boolean(videoSrc) && !reducedMotion,
  });
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
              thumbSrc={src}
              active={playPreview}
            />
          ) : (
            <TileStill src={src} />
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
        className={`wallpaper-category-cover${empty && !paint && !coverSrc ? " wallpaper-category-cover-empty" : ""}`}
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
