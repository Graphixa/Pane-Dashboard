import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { IconButton, Text } from "./design/components";
import { X } from "lucide-react";

export default function Modal({
  title,
  close,
  children,
  className,
  style,
  draggable = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When true, the title bar can drag the dialog (Settings). */
  draggable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const onTitlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const dialog = ref.current;
    if (!dialog) return;
    e.preventDefault();
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onTitlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const dialog = ref.current;
    if (!dialog) return;
    const nextX = state.originX + (e.clientX - state.startX);
    const nextY = state.originY + (e.clientY - state.startY);
    const rect = dialog.getBoundingClientRect();
    // Keep enough of the title bar on-screen to grab again.
    const minVisible = 48;
    const maxX = window.innerWidth - minVisible;
    const maxY = window.innerHeight - minVisible;
    const minX = minVisible - rect.width;
    const minY = 0;
    // Convert proposed translate into viewport bounds using current untranslated rect.
    const untranslatedLeft = rect.left - offset.x;
    const untranslatedTop = rect.top - offset.y;
    const clampedX = Math.min(
      maxX - untranslatedLeft,
      Math.max(minX - untranslatedLeft, nextX),
    );
    const clampedY = Math.min(
      maxY - untranslatedTop,
      Math.max(minY - untranslatedTop, nextY),
    );
    setOffset({ x: clampedX, y: clampedY });
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <dialog
      className={className}
      ref={ref}
      style={{
        ...style,
        transform: draggable
          ? `translate(${offset.x}px, ${offset.y}px)`
          : style?.transform,
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div
        className={`modal-title${draggable ? " modal-title-draggable" : ""}`}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Text as="h2" variant="title">{title}</Text>
        <IconButton
          variant="quiet"
          className="icon-button"
          label="Close"
          onClick={close}
        >
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

