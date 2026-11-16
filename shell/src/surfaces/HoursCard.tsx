import { useMemo, useRef } from "react";
import { Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetTitle, usePhone } from "@lifeline/ui";
import { appById, describeSpan, formatHuman, formatTime, type HoursTapped } from "@lifeline/core";
import { keepFocus } from "./itemKeys";

/** Anchors the popover to an element that may re-render away: keep its last box. */
function useVirtualAnchor(el: HTMLElement | null) {
  return useMemo(() => {
    let last = el?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
    return {
      current: {
        getBoundingClientRect: () => {
          if (el?.isConnected) last = el.getBoundingClientRect();
          return last;
        },
      },
    };
  }, [el]);
}

/**
 * Closing hands the focus back to the item (#284), as a menu does to its
 * trigger; an item redrawn elsewhere is found again by its `data-focus-key`.
 */
function useReturnFocus(anchor: HTMLElement | null) {
  const content = useRef<HTMLDivElement>(null);
  const onCloseAutoFocus = (e: Event) => {
    const active = document.activeElement;
    if (!anchor || (active && active !== document.body && !content.current?.contains(active))) return;
    e.preventDefault();
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
    else if (anchor.dataset.focusKey) keepFocus(anchor.dataset.focusKey);
  };
  return { ref: content, onCloseAutoFocus };
}

/** "Tue, Nov 10 · 10:00 – 11:00", or "… · all day": the whole item, from any of its pieces (ADR 0090). */
function whenOf(tapped: HoursTapped): string {
  if (tapped.kind === "work") {
    const { item } = tapped;
    const day = item.displayDate ?? item.date;
    if (!day) return "Not placed";
    return item.start ? `${formatHuman(day)} · ${formatTime(item.start)}${item.end ? ` – ${formatTime(item.end)}` : ""}` : `${formatHuman(day)} · all day`;
  }
  const { item } = tapped;
  const span = item.span;
  if (!item.start) return `${formatHuman(item.date)} · all day`;
  if (span) return `${formatHuman(span.date)} · ${describeSpan(span)}`;
  return `${formatHuman(item.date)} · ${formatTime(item.start)}${item.end ? ` – ${formatTime(item.end)}` : ""}`;
}

/**
 * What a tap on the hours shows for an item with no Document to peek (#538): a
 * Calendar subscription's occurrence (ADR 0017), which nothing in Lifeline
 * writes. A small read-only card — title, day and time, where, and the
 * subscription it comes from — beside the item at a desk, a bottom sheet on a
 * phone. There is nothing to edit.
 */
export function HoursCard({ tapped, anchor, onClose }: { tapped: HoursTapped; anchor: HTMLElement | null; onClose: () => void }) {
  const isMobile = usePhone();
  const virtual = useVirtualAnchor(anchor);
  const returnFocus = useReturnFocus(anchor);
  const { item } = tapped;
  const source = (tapped.kind === "timed" ? tapped.item.source : undefined) ?? appById(item.appId)?.title;
  const subtitle = tapped.kind === "timed" ? tapped.item.subtitle : undefined;
  const where = subtitle && subtitle !== source ? subtitle : null;
  const color = item.color ?? "var(--muted-foreground)";

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 flex-1 font-medium break-words">{item.title}</span>
      </div>
      <p className="text-sm">{whenOf(tapped)}</p>
      {where && <p className="text-muted-foreground min-w-0 text-sm break-words">{where}</p>}
      {source && <p className="text-muted-foreground min-w-0 text-xs break-words">From {source} · read-only</p>}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent {...returnFocus} side="bottom" className="gap-3 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-describedby={undefined}>
          <span className="bg-muted-foreground/30 mx-auto h-1 w-10 shrink-0 rounded-full" aria-hidden />
          <SheetTitle className="sr-only">{item.title}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor virtualRef={virtual} />
      <PopoverContent {...returnFocus} role="dialog" aria-label={item.title} side="right" align="start" className="grid w-[min(22rem,calc(100vw-2rem))] gap-2">
        {body}
      </PopoverContent>
    </Popover>
  );
}
