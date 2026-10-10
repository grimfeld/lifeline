import { useState, useSyncExternalStore, type ReactNode } from "react";
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
 * places: `page` on top, `module` against the bar. A page may put several rows
 * in its slot — its actions, then its tabs nearest the thumb (`order`).
 *
 * What goes in: whatever changes what the page shows (tabs, view switches,
 * date paging), its search, and its main add. What stays: the title, and the
 * header of a single thing's own page (back, edit, delete). Filters beyond a
 * search go behind `PhoneFilters`, so the dock stays a row or two.
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

/** The usual dock row: one line of controls that scrolls sideways rather than wrapping. */
export const phoneDockRow = "flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Controls that sit in the phone dock on a phone and where they stand on the
 * desk. `className` wraps them in the dock only — the desk keeps their own;
 * `row` is shorthand for `phoneDockRow`. `order` places this row among the
 * page's others (higher is nearer the bar); rows of equal order keep mount order.
 */
export function PhoneDock({
  slot = "page",
  className,
  row = false,
  order,
  children,
}: {
  slot?: PhoneDockSlot;
  className?: string;
  row?: boolean;
  order?: number;
  children: ReactNode;
}) {
  const phone = usePhone();
  const target = useTarget(slot);
  if (!phone) return <>{children}</>;
  if (!target) return null;
  return createPortal(
    <div className={cn(row && phoneDockRow, className)} style={order === undefined ? undefined : { order }}>
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
