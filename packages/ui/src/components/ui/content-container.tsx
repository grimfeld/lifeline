import { createContext, useContext, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { usePhone } from "./phone-dock";

/**
 * **Content follows its container, not the viewport** (ADR 0064, amended by the
 * Hub's ADR): a Module laid out in a box narrower than this gets its narrow
 * layout, whatever the screen. The same line the phone is drawn at (`md`), so a
 * phone, whose container is the whole screen, gets the same answer either way.
 */
export const NARROW_BELOW = 768;

/** Whether a container this wide (CSS px, its content box) gets the narrow layout. */
export function isNarrowWidth(width: number): boolean {
  return width < NARROW_BELOW;
}

/**
 * The width of the content container around this component, or `null` where
 * no `ContentContainer` is: then the container is the page root, which spans
 * the viewport (until Windows exist, it is the only container there is).
 */
const ContainerWidth = createContext<number | null>(null);

/**
 * Is my container narrow? The layout question: a split that becomes a stack,
 * tabs that become a select, a thumb-sized button. It reads the width of the
 * nearest `ContentContainer`, or the viewport's when there is none (the page
 * root). Never use it for phone *navigation* — the Phone bar, the Phone dock's
 * move to the bottom: that is the device's, `usePhone()`.
 *
 * Portalled content (a dialog, a popover, a Sheet) still gets its opener's
 * container through React context, which a CSS container query can't reach.
 */
export function useNarrow(): boolean {
  const width = useContext(ContainerWidth);
  const phone = usePhone();
  return width === null ? phone : isNarrowWidth(width);
}

/** The content box width of an element: what an `inline-size` container query measures. */
function contentWidth(el: HTMLElement): number {
  const s = getComputedStyle(el);
  return el.clientWidth - (parseFloat(s.paddingLeft) || 0) - (parseFloat(s.paddingRight) || 0);
}

/**
 * A box content lays itself out in: a CSS size container named `content` (what
 * the `cq-md:`, `cq-max-md:`… variants query) that also hands its width to
 * `useNarrow()` below it, so the class and the hook give the same answer.
 * The shell's page root is one; each Window will be one.
 */
export function ContentContainer({ className, children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(contentWidth(el));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} data-slot="content-container" className={cn("content-container", className)} {...props}>
      <ContainerWidth.Provider value={width}>{children}</ContainerWidth.Provider>
    </div>
  );
}
