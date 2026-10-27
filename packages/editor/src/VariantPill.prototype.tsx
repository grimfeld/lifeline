// PROTOTYPE for #372 — throwaway, never merged.
//
// A floating pill at the bottom centre naming the live-preview reveal variant,
// with ‹ › to switch. ←/→ cycle too, while no editor or field has focus. Shown
// only once `?variant=` has been used on this device.

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@lifeline/ui";
import { cycleVariant, getVariant, pillEnabled, subscribeVariant, VARIANTS } from "./variant.prototype";

/** The pill's height plus its gap, in px: the editor keeps this much room below the caret while it shows. */
export const PILL_ROOM = 48;

/** One pill however many editors are mounted: the first one to mount draws it. */
const owners: string[] = [];
const ownerListeners = new Set<() => void>();
const subscribeOwners = (l: () => void) => {
  ownerListeners.add(l);
  return () => {
    ownerListeners.delete(l);
  };
};

function editable(el: Element | null) {
  if (!el || el === document.body) return false;
  const h = el as HTMLElement;
  return h.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName) || !!h.closest(".cm-editor");
}

export function VariantPill({ bottom }: { bottom: number }) {
  const id = useId();
  const variant = useSyncExternalStore(subscribeVariant, getVariant);
  const owner = useSyncExternalStore(subscribeOwners, () => owners[0]);

  useEffect(() => {
    owners.push(id);
    ownerListeners.forEach((l) => l());
    return () => {
      owners.splice(owners.indexOf(id), 1);
      ownerListeners.forEach((l) => l());
    };
  }, [id]);

  useEffect(() => {
    if (owner !== id || !pillEnabled()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (editable(document.activeElement)) return;
      e.preventDefault();
      cycleVariant(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [owner, id]);

  if (owner !== id || !pillEnabled()) return null;
  const name = VARIANTS.find((v) => v.id === variant)?.name ?? "";
  return createPortal(
    <div
      className="bg-foreground text-background fixed left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full px-1 py-0.5 text-sm font-medium shadow-lg"
      style={{ bottom }}
      role="group"
      aria-label="Live preview variant (prototype #372)"
      // The pill must not take focus from the editor (the phone keyboard would close).
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
    >
      <Button variant="ghost" size="icon-xs" aria-label="Previous variant" className="text-background hover:bg-background/20 hover:text-background" onClick={() => cycleVariant(-1)}>
        <ChevronLeft />
      </Button>
      <span className="px-1 tabular-nums">
        {variant} · {name}
      </span>
      <Button variant="ghost" size="icon-xs" aria-label="Next variant" className="text-background hover:bg-background/20 hover:text-background" onClick={() => cycleVariant(1)}>
        <ChevronRight />
      </Button>
    </div>,
    document.body,
  );
}
