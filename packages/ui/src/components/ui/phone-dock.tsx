import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

/**
 * The **phone dock**: the strip right above the Phone bar where a page's
 * controls sit on a phone — a Module's tabs, the Calendar's view and paging,
 * anything a thumb reaches for — rather than at the top of the screen. On the
 * desk nothing moves: a `PhoneDock` renders its children where it stands.
 *
 * Two rows, so a page's own controls and its Module's navigation never trade
 * places: `page` on top, `module` against the bar.
 */
export type PhoneDockSlot = "page" | "module";

const targets: Record<PhoneDockSlot, HTMLElement | null> = { page: null, module: null };
const listeners = new Set<() => void>();

function setTarget(slot: PhoneDockSlot, el: HTMLElement | null) {
  if (targets[slot] === el) return;
  targets[slot] = el;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Below Tailwind `md`: the same line `useIsMobile` draws, kept here so the kit needs no Core. */
const PHONE = "(max-width: 767px)";

function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

function useTarget(slot: PhoneDockSlot): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => targets[slot], () => null);
}

const rowClass = "bg-background flex shrink-0 flex-col border-t empty:hidden";

/** Where the dock's rows are mounted: once, right above the Phone bar. Phone only. */
export function PhoneDockHost({ className }: { className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col md:hidden", className)}>
      <div ref={(el) => setTarget("page", el)} className={rowClass} />
      <div ref={(el) => setTarget("module", el)} className={rowClass} />
    </div>
  );
}

/**
 * Controls that sit in the phone dock on a phone and where they stand on the
 * desk. `className` wraps them in the dock only — the desk keeps their own.
 */
export function PhoneDock({ slot = "page", className, children }: { slot?: PhoneDockSlot; className?: string; children: ReactNode }) {
  const phone = usePhone();
  const target = useTarget(slot);
  if (!phone) return <>{children}</>;
  if (!target) return null;
  return createPortal(<div className={className}>{children}</div>, target);
}
