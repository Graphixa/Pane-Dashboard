import { CSSProperties, ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({
  title,
  close,
  children,
  className,
  style,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={className}
      ref={ref}
      style={style}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
