import { CSSProperties, ReactElement, ReactNode, PointerEvent, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { Button, IconButton, Text } from './components';
import { SurfaceProvider, useSurface } from './surface';

export function Modal(props: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  theme?: 'dark' | 'light';
  draggable?: boolean;
  nested?: boolean;
  placement?: 'center' | 'bottom';
  backdrop?: 'dim' | 'none';
}) {
  return <SurfaceProvider style={props.style} theme={props.theme}><ModalContent {...props} /></SurfaceProvider>;
}
function ModalContent({
  title,
  close,
  children,
  className = '',
  draggable = false,
  nested = false,
  placement = 'center',
  backdrop = 'dim',
}: Parameters<typeof Modal>[0]) {
  const surface = useSurface();
  const opener = useRef<HTMLElement | null>(null), content = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: number; x: number; y: number; ox: number; oy: number} | null>(null);
  const [offset, setOffset] = useState({x: 0, y: 0});
  // Radix has no Trigger for conditionally mounted application editors.
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const state = drag.current, el = content.current;
    if (!state || e.pointerId !== state.id || !el || placement !== 'center') return;
    const rect = el.getBoundingClientRect(), left = rect.left - offset.x, top = rect.top - offset.y;
    setOffset({x: Math.max(48 - rect.width - left, Math.min(innerWidth - 48 - left, state.ox + e.clientX - state.x)), y: Math.max(-top, Math.min(innerHeight - 48 - top, state.oy + e.clientY - state.y))});
  };
  const end = (e: PointerEvent<HTMLDivElement>) => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); };
  const nest = nested ? ' ui-dialog-nested' : '';
  const place = placement === 'bottom' ? ' ui-dialog-bottom' : '';
  const contentStyle = placement === 'bottom'
    ? {...surface.style}
    : {...surface.style, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`};
  return <Dialog.Root open onOpenChange={open => {if (!open) close();}}><Dialog.Portal>
    {backdrop === 'dim' && <Dialog.Overlay className={`ui-dialog-backdrop${nest}`} />}
    <Dialog.Content {...surface} ref={content} aria-describedby={undefined} className={`ui-dialog ui-overlay-surface${nest}${place} ${className}`} style={contentStyle}
      onOpenAutoFocus={() => {opener.current = document.activeElement as HTMLElement;}}
      onCloseAutoFocus={e => {e.preventDefault(); if (opener.current?.isConnected) opener.current.focus();}}
      onInteractOutside={e => e.preventDefault()}
      onWheel={e => e.stopPropagation()}>
      <div className={`modal-title${draggable && placement === 'center' ? ' modal-title-draggable' : ''}`} onPointerDown={e => {
        if (!draggable || placement !== 'center' || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
        e.preventDefault(); drag.current = {id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y}; e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <Dialog.Title asChild><Text as="h2" variant="title">{title}</Text></Dialog.Title>
        <IconButton variant="quiet" label="Close" onClick={close}><X size={20} aria-hidden="true" /></IconButton>
      </div>{children}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
export function Popover({trigger, open, onOpenChange, children, label, size = 'compact'}: {trigger: ReactElement; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; label: string; size?: 'compact' | 'image'}) {
  const surface = useSurface();
  return <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}><PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal><PopoverPrimitive.Content {...surface} aria-label={label} className={`ui-popover ui-popover-${size} ui-overlay-surface`} sideOffset={8} align="start" collisionPadding={12} updatePositionStrategy="always" onEscapeKeyDown={e => e.stopPropagation()}>{children}</PopoverPrimitive.Content></PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
export function DropdownMenu({trigger, items, open, onOpenChange}: {trigger: ReactElement; items: {label: string; icon?: ReactNode; disabled?: boolean; onSelect?: () => void}[]; open?: boolean; onOpenChange?: (open: boolean) => void}) {
  const surface = useSurface();
  return <Menu.Root open={open} onOpenChange={onOpenChange}><Menu.Trigger asChild>{trigger}</Menu.Trigger><Menu.Portal><Menu.Content {...surface} className="ui-menu ui-overlay-surface" align="end" sideOffset={8} collisionPadding={12}>
    {items.map(item => <Menu.Item key={item.label} disabled={item.disabled} onSelect={item.onSelect} className="ui-menu-item">{item.icon}{item.label}</Menu.Item>)}
  </Menu.Content></Menu.Portal></Menu.Root>;
}
export function Tooltip({label, children}: {label: string; children: ReactElement}) {
  const surface = useSurface();
  return <TooltipPrimitive.Provider delayDuration={400}><TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content {...surface} className="ui-tooltip ui-overlay-surface" sideOffset={6}>{label}</TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root></TooltipPrimitive.Provider>;
}
/** Caller-owned copy for discard, delete and replace confirmations. */
export type ConfirmRequest = {
  title: string;
  description: string;
  cancelLabel: string;
  actionLabel: string;
  actionVariant?: "danger" | "primary" | "secondary";
};

/** Promise-based caller API; the dialog and focus behaviour remain centralised. */
export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => () => {pending.current?.(false);}, []);
  const finish = (value: boolean) => {pending.current?.(value); pending.current = null; setRequest(null);};
  const confirm = (next: ConfirmRequest) => new Promise<boolean>(resolve => {
    pending.current?.(false);
    opener.current = document.activeElement as HTMLElement;
    pending.current = resolve;
    setRequest(next);
  });
  const confirmation = <ConfirmationDialog request={request} finish={finish} opener={opener} />;
  return {confirm, confirmation};
}

function ConfirmationDialog({request, finish, opener}: {
  request: ConfirmRequest | null;
  finish: (value: boolean) => void;
  opener: React.RefObject<HTMLElement | null>;
}) {
  const surface = useSurface();
  return <AlertDialog.Root open={request !== null} onOpenChange={open => {if (!open) finish(false);}}><AlertDialog.Portal>
    <AlertDialog.Overlay className="ui-dialog-backdrop" />
    <AlertDialog.Content {...surface} className="ui-dialog ui-confirm ui-overlay-surface" onCloseAutoFocus={e => {e.preventDefault(); if (opener.current?.isConnected) opener.current.focus();}}>
      <AlertDialog.Title asChild><Text as="h2" variant="title">{request?.title}</Text></AlertDialog.Title>
      <AlertDialog.Description className="ui-confirm-description">{request?.description}</AlertDialog.Description>
      <div className="ui-actions">
        <AlertDialog.Cancel asChild><Button onClick={() => finish(false)}>{request?.cancelLabel}</Button></AlertDialog.Cancel>
        <AlertDialog.Action asChild><Button variant={request?.actionVariant ?? "danger"} onClick={() => finish(true)}>{request?.actionLabel}</Button></AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal></AlertDialog.Root>;
}
