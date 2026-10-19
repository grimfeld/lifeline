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

/**
 * The phone nav's rendered height (the phone dock above it and its safe-area
 * padding included), published by the shell's `MobileNav` and read by whatever
 * has to sit above it — today the editor's key accessory bar, which used to take
 * the nav's row over.
 *
 * A module store and not a measurement each side takes for itself: the height is
 * the nav's own business (padding, safe area, whether it is on screen at all),
 * and the bar lives in another package with no way to reach the element.
 */
let phoneNavHeight = 0;
const navHeightListeners = new Set<() => void>();

/** Report the phone nav's height — 0 when it is not rendered. */
export function setPhoneNavHeight(px: number): void {
  if (px === phoneNavHeight) return;
  phoneNavHeight = px;
  for (const listener of navHeightListeners) listener();
}

/**
 * Keep the screen on while something is running; released on unmount or when
 * the tab hides. A browser capability like the two above, and asked for by
 * anything that is watched rather than touched — the workout timer counting
 * down, a Writing being read aloud from the page (both would otherwise go dark
 * mid-use, since neither takes input while it runs).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: { release(): Promise<void> } | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          lock = await (navigator as Navigator & { wakeLock: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen");
        }
      } catch {
        /* denied */
      }
    };
    const onVisible = () => {
      if (alive && document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** How much of the frame's bottom the phone nav occupies; 0 above `md`, and on the server. */
export function usePhoneNavHeight(): number {
  return useSyncExternalStore(
    (cb) => {
      navHeightListeners.add(cb);
      return () => {
        navHeightListeners.delete(cb);
      };
    },
    () => phoneNavHeight,
    () => 0,
  );
}
