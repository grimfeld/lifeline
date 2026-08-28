import { useSyncExternalStore } from "react";

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
