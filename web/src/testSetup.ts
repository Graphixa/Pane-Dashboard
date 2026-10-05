// Browser APIs absent from jsdom; behaviour still comes from the real Radix components.
if (typeof window !== 'undefined') {
  if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as unknown as typeof ResizeObserver;
  if (!window.PointerEvent) window.PointerEvent = class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse';}
  } as typeof PointerEvent;
  HTMLElement.prototype.scrollIntoView ??= function () {};
  HTMLElement.prototype.hasPointerCapture ??= function () {return false;};
  HTMLElement.prototype.setPointerCapture ??= function () {};
  HTMLElement.prototype.releasePointerCapture ??= function () {};
}
