import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

/**
 * The **phone dock**: the strip right above the Phone bar where a page's
 * controls sit on a phone — a Module's tabs, the Calendar's view and paging,
 * anything a thumb reaches for — rather than at the top of the screen. On the
 * desk nothing moves: a `PhoneDock` renders its children where it stands.
 *
 * Two slots, so a page's own controls and its Module's navigation never trade
 * places: `page` on top, `module` against the bar.
 *
 * The `page` slot is **one line**: every `PhoneDock` a page renders pours its
 * children into the same wrapping row, as direct items (`order` places them —
 * higher is nearer the end). Each item grows to share the line, so whatever
 * ends up alone on a line takes its full width; icon buttons keep their size.
 * So give the dock *controls*, not wrappers: a div around a group grows, but
 * the buttons inside it don't — mark such a div `max-md:contents`.
 *
 * What goes in: whatever changes what the page shows (tabs — which are a
 * select on a phone — view switches, date paging), its search, and its main
 * add. What stays: the title, quick-add fields, and the header of a single
 * thing's own page (back, edit, delete). Filters beyond a search go behind
 * `PhoneFilters`, so the line stays one line. (ADR 0064)
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

export function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

function useTarget(slot: PhoneDockSlot): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => targets[slot], () => null);
}

const slotClass = "bg-background shrink-0 border-t empty:hidden";

/**
 * The page line: wrapping, its items growing to fill each line. Items are the
 * children of each `PhoneDock`'s `display: contents` wrapper (and of groups
 * unwrapped with `max-md:contents` inside it), which hands them its order
 * through `--dock-order` — the rules are in globals.css, `[data-phone-dock-line]`.
 */
const pageLine = cn(slotClass, "flex flex-wrap items-center gap-1.5 px-3 py-1.5");

/** Where the dock's rows are mounted: once, right above the Phone bar. Phone only. */
export function PhoneDockHost({ className }: { className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col md:hidden", className)}>
      <div ref={(el) => setTarget("page", el)} className={pageLine} data-phone-dock-line="" />
      <div ref={(el) => setTarget("module", el)} className={cn(slotClass, "flex flex-col")} />
    </div>
  );
}

/**
 * Controls that sit in the phone dock on a phone and where they stand on the
 * desk. On the page line `order` places them (default 0; tabs and view
 * switches take 1, so they end the line nearest the thumb). The `module` slot
 * holds one row and takes its children as they are.
 */
export function PhoneDock({ slot = "page", order = 0, children }: { slot?: PhoneDockSlot; order?: number; children: ReactNode }) {
  const phone = usePhone();
  const target = useTarget(slot);
  if (!phone) return <>{children}</>;
  if (!target) return null;
  return createPortal(
    <div className="contents" style={{ "--dock-order": order } as CSSProperties}>
      {children}
    </div>,
    target,
  );
}

/**
 * A page's filters: in place on the desk; on a phone a "Filters" button (for
 * the dock) that opens them in a sheet from the bottom. `active` counts the
 * filters set, shown on the button so a narrowed list never looks complete.
 */
export function PhoneFilters({
  active = 0,
  title = "Filters",
  className,
  children,
}: {
  active?: number;
  title?: string;
  /** The sheet's body on a phone. */
  className?: string;
  children: ReactNode;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  if (!phone) return <>{children}</>;
  return (
    <>
      <Button size="sm" variant={active > 0 ? "secondary" : "outline"} className="shrink-0" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> {title}
        {active > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] tabular-nums">{active}</span>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetTitle>{title}</SheetTitle>
          <div className={cn("flex flex-col gap-3 p-4", className)}>{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
