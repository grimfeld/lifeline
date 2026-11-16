import { Ban, Inbox } from "lucide-react";
import { Button, toast } from "@lifeline/ui";
import { addTimeBlock, BLOCK_DEFAULT_MIN, clockMinutes, clockOf, formatHuman, formatTime, unplaceItem, usePoolItems, type DateStr, type PoolItem, type TimeStr } from "@lifeline/core";
import { addBlockerFromTemplate, useBlockerTemplates } from "../data/blockerTemplates";
import { deleteTimeBlocker } from "../data/blockers";

const DAY_MIN = 24 * 60;

/** A Time block's end, `min` after its start, kept on its day (a Placement has one date): at 24:00 at the latest. */
function blockEnd(start: TimeStr, min: number): TimeStr {
  const end = Math.min(DAY_MIN, (clockMinutes(start) ?? 0) + min);
  return end === DAY_MIN ? "24:00" : clockOf(end);
}

/**
 * The Event dialog's **"Or place here"** (#539): instead of an Event, a
 * Blocker template (a one-off Time blocker from it) or unplaced work (a new
 * Time block, ADR 0028), at the Form's day and `start`, with one tap that
 * closes the dialog. `start` is null while the Form is all day: then it asks
 * for a start time and places nothing. With nothing to place, it is not shown.
 */
export function PlaceHere({ date, start, onPlaced }: { date: DateStr; start: TimeStr | null; onPlaced: () => void }) {
  const blockers = useBlockerTemplates();
  const work = usePoolItems().filter((w) => !w.completedOn);
  if (blockers.length === 0 && work.length === 0) return null;
  const fail = (err: unknown) => toast.error(`Could not place it: ${err instanceof Error ? err.message : String(err)}`);

  function placeBlocker(id: string) {
    if (!start) return;
    onPlaced();
    addBlockerFromTemplate(id, date, start)
      .then((made) => {
        if (made) toast.success(`${made.title} at ${formatTime(made.start)}`, { action: { label: "Undo", onClick: () => void deleteTimeBlocker(made.id).catch(fail) } });
      })
      .catch(fail);
  }
  function placeWork(w: PoolItem) {
    if (!start) return;
    onPlaced();
    const len = w.estimateMin && w.estimateMin > 0 ? w.estimateMin : BLOCK_DEFAULT_MIN;
    addTimeBlock(w.appId, w.itemId, date, { start, end: blockEnd(start, len) })
      .then((id) => toast.success(`${w.title} at ${formatTime(start)}`, { action: { label: "Undo", onClick: () => void unplaceItem(id).catch(fail) } }))
      .catch(fail);
  }

  return (
    <div role="group" aria-label="Or place here" className="grid min-w-0 gap-2 border-t pt-3">
      <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
        {start ? `Or place here, ${formatHuman(date)} at ${formatTime(start)}` : "Or place here"}
      </span>
      {!start && <p className="text-muted-foreground text-sm">Give it a start time to place something here.</p>}
      {blockers.length > 0 && (
        <div className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Ban className="size-3.5" /> Blocker templates
          </span>
          <div className="flex max-h-24 min-w-0 flex-wrap gap-1.5 overflow-y-auto">
            {blockers.map((t) => (
              <Button key={t.id} type="button" size="sm" variant="outline" disabled={!start} className="h-auto min-w-0 max-w-full border-dashed py-1" onClick={() => placeBlocker(t.id)}>
                <span className="min-w-0 break-words whitespace-normal text-left [overflow-wrap:anywhere]">{t.title}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      {work.length > 0 && (
        <div className="grid min-w-0 gap-1.5">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Inbox className="size-3.5" /> Unplaced work
          </span>
          <div className="grid max-h-40 min-w-0 gap-1 overflow-y-auto">
            {work.map((w) => (
              <Button key={w.key} type="button" variant="outline" disabled={!start} className="h-auto min-w-0 justify-start gap-2 px-2 py-1.5 text-left font-normal" onClick={() => placeWork(w)}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: w.color ?? "var(--muted-foreground)" }} />
                <span className="min-w-0 flex-1 break-words whitespace-normal [overflow-wrap:anywhere]">{w.title}</span>
                {w.estimateMin ? <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{w.estimateMin}m</span> : null}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
