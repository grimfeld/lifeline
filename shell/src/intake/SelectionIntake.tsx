import { useEffect, useRef, useState } from "react";
import { allIntakes, rememberIntake, useDocument, useLastIntakeKey, type Handoff } from "@lifeline/core";
import { readBodySelection, SELECTION_EVENT, type BodySelection } from "@lifeline/editor";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, PhoneDock, usePhone } from "@lifeline/ui";
import { Send } from "lucide-react";

/** Per-device memory of the Intake last chosen from a selection, beside each App's own (ADR 0050). */
const SENDER = "selection";

/** A selection that empties is let go after this long — long enough for the tap that hands it off to land. */
const LINGER_MS = 400;

/**
 * Selecting text in any Document's body offers every Intake Core knows
 * (ADR 0073, CONTEXT.md "Handoff"): the passage goes as the Handoff's text and
 * the Document it was selected in as its origin. The receiving App's dialog
 * decides what to make of it; nothing is written until it saves.
 *
 * On the desk the offer floats just above the selection; on a phone it sits
 * in the dock (ADR 0064), clear of the system's own selection menu.
 */
export function SelectionIntake() {
  const phone = usePhone();
  const [sel, setSel] = useState<BodySelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [handing, setHanding] = useState<{ key: string; handoff: Handoff } | null>(null);
  // The last selection seen: a tap on the offer may clear the live one before the click lands.
  const last = useRef<BodySelection | null>(null);
  const origin = useDocument(sel?.originId ?? last.current?.originId);
  const lastKey = useLastIntakeKey(SENDER);

  useEffect(() => {
    let linger: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readBodySelection();
        clearTimeout(linger);
        if (next) {
          last.current = next;
          setSel(next);
        } else linger = setTimeout(() => setSel(null), LINGER_MS);
      });
    };
    document.addEventListener("selectionchange", read);
    document.addEventListener(SELECTION_EVENT, read);
    window.addEventListener("scroll", read, true);
    return () => {
      document.removeEventListener("selectionchange", read);
      document.removeEventListener(SELECTION_EVENT, read);
      window.removeEventListener("scroll", read, true);
      clearTimeout(linger);
      cancelAnimationFrame(frame);
    };
  }, []);

  const intakes = allIntakes();
  const shown = sel ?? (menuOpen ? last.current : null);

  function hand(key: string) {
    const s = last.current;
    if (!s) return;
    rememberIntake(SENDER, key);
    setMenuOpen(false);
    setHanding({ key, handoff: { title: origin?.title || s.text.slice(0, 80), text: s.text, originId: s.originId } });
  }

  const chosen = handing ? intakes.find((i) => i.key === handing.key) : undefined;
  const keep = (e: { preventDefault: () => void }) => e.preventDefault(); // keep the selection while pressing
  const offer = shown && intakes.length > 0 && (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={phone ? "outline" : "secondary"} className="shadow-sm" onPointerDown={keep} onMouseDown={keep}>
          <Send /> Hand off…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {[...intakes]
          .sort((a, b) => (a.key === lastKey ? -1 : b.key === lastKey ? 1 : 0))
          .map((i) => (
            <DropdownMenuItem key={i.key} onSelect={() => hand(i.key)}>
              {i.icon && <i.icon className="size-4" />}
              {i.title}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const top = shown ? (shown.rect.top > 56 ? shown.rect.top - 40 : shown.rect.bottom + 8) : 0;
  const left = shown ? Math.min(Math.max(8, shown.rect.left), window.innerWidth - 140) : 0;

  return (
    <>
      {offer && (phone ? <PhoneDock>{offer}</PhoneDock> : <div className="fixed z-50" style={{ top, left }}>{offer}</div>)}
      {chosen && handing && <chosen.dialog open onOpenChange={(o) => !o && setHanding(null)} handoff={handing.handoff} />}
    </>
  );
}
