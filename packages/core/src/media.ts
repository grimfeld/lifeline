import { useEffect, useState, useSyncExternalStore } from "react";

/** Below Tailwind `md` (768px): the phone frame (ADR 0021). */
const PHONE = "(max-width: 767px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Whether the app is rendering in the phone frame. CSS handles most of it;
 * this is for the cases where a phone needs a different component, not a
 * different rule — an aside that becomes a sheet, a split that becomes a
 * stack (ADR 0021, "parity grows page-by-page").
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
}

/**
 * How much of the layout viewport is hidden below the visual one — the on-screen
 * keyboard, in practice (plus whatever accessory strip the OS puts above it).
 *
 * There is no portable "keyboard height": iOS never shrinks the layout viewport
 * for the keyboard, so `position: fixed; bottom: 0` sits *under* it. Chromium
 * does shrink it — the shell asks for `interactive-widget=resizes-content` —
 * and there this reads 0, which is the right answer *and* the better one: the
 * browser counts whatever the on-screen keyboard actually occupies, the IME's
 * own toolbar row included, which the visual viewport alone does not.
 *
 * Measured against `documentElement.clientHeight` and not `window.innerHeight`:
 * the initial containing block is the box a `position: fixed` bottom resolves
 * against, and the two are not the same number on a phone browser.
 *
 * Pass `enabled: false` on the desktop to keep the listeners off.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = enabled ? window.visualViewport : null;
    if (!vv) {
      setInset(0);
      return;
    }
    const read = () => setInset(Math.max(0, Math.round(document.documentElement.clientHeight - vv.height - vv.offsetTop)));
    read();
    // `scroll` too: iOS shifts the visual viewport within the layout one as the
    // caret is kept in sight, which moves the keyboard's top edge without resizing.
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, [enabled]);
  return inset;
}
