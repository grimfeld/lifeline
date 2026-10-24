import { useRef } from "react";

type AutoFocusHandler = (event: Event) => void;

/**
 * Where focus goes when a Dialog, Sheet or AlertDialog closes (WCAG 2.4.3).
 *
 * Radix returns it to the Trigger only, so a dialog opened without one — the
 * Peek from a link, the command palette, a dialog from a menu item — dropped it
 * on `<body>`. This records what had focus as the content opens (Radix's
 * `onOpenAutoFocus` runs before focus moves inside) and, on close, puts focus
 * back there while that element is still in the page. When it is gone, Radix's
 * own behaviour (the Trigger, if any) stands. The caller's own handlers run
 * first, and a `preventDefault()` in its `onCloseAutoFocus` keeps focus where
 * the caller put it.
 */
export function useReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  onOpenAutoFocus?: AutoFocusHandler;
  onCloseAutoFocus?: AutoFocusHandler;
}): { onOpenAutoFocus: AutoFocusHandler; onCloseAutoFocus: AutoFocusHandler } {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event) => {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      opener.current = null;
      if (event.defaultPrevented || !target?.isConnected) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}
