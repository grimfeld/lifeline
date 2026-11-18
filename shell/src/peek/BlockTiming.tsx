import { useReducer, useRef } from "react";
import { Button, DatePicker, Field, QuickTiming, TimeField, toast, toastWithUndo } from "@lifeline/ui";
import { addDays, formatHuman, formatTime, SNAP_MIN, todayStr, type HoursTapped } from "@lifeline/core";
import { Check, Trash2 } from "lucide-react";
import { blockEnd, blockLasting, blockNudged, type BlockTime } from "./blockTiming";
import { blockVisit } from "./peekVisit";

/**
 * The **timing section** of a work item's Peek opened from the hours (#537):
 * above the App's part, the Time block that was tapped — its day, its start
 * (15 minutes earlier / later, Tomorrow), its length, and Remove block. A
 * block is a placement (ADR 0028): it is written through the placement
 * operations, and removing it leaves the Task and its untimed chip. An
 * untimed chip is a source: giving it a start makes a new block, the chip
 * stays. A done item's block is record — removable, never retimed.
 *
 * Every change is written at once and noted to the Peek (`noteTiming`), which
 * leaves one Undo for the visit on closing (ADR 0056, #536); Remove block acts
 * at once with its own Undo. **Complete** ticks the item off by its own id (a
 * recurring Task's Occurrence), so a chip with no tick of its own — a phone's
 * Week, a Month chip — can still be done from here (F2). The timing is the visit's (`blockVisit`), kept
 * while the Peek is open.
 */
export function BlockTiming({ tapped }: { tapped: HoursTapped & { kind: "work" } }) {
  const item = tapped.item;
  // The visit keeps the timing, so Back from a link goes on where it was (F1).
  const visit = blockVisit(tapped, todayStr());
  const [, changed] = useReducer((n: number) => n + 1, 0);
  const { time, hasBlock } = visit;
  const done = !!item.completedOn || visit.completed;
  const section = useRef<HTMLElement>(null);

  function complete() {
    void visit.complete().then((ok) => {
      if (ok) toast.success(`${item.title} done`);
      changed();
    });
  }

  function write(next: BlockTime) {
    visit.write(next);
    changed();
  }

  function remove() {
    // The button unmounts with the block: focus goes to what stays, the Start field or the Peek itself (F10).
    const peek = section.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const undone = visit.remove();
    changed();
    queueMicrotask(() => requestAnimationFrame(() => (section.current?.querySelector<HTMLElement>('[role="combobox"]') ?? peek)?.focus()));
    void undone.then((undo) => {
      if (undo) toastWithUndo("Block removed — the task stays", undo);
    });
  }

  const tomorrow = addDays(todayStr(), 1);
  const removeButton = (
    <Button variant="destructive" size="sm" className="justify-self-start" onClick={remove}>
      <Trash2 /> Remove block
    </Button>
  );

  if (done && !hasBlock) return null;
  return (
    <section ref={section} aria-label="Time block" className="grid gap-3 rounded-lg border p-3">
      <h3 className="text-muted-foreground text-sm font-medium">{hasBlock ? "Time block" : "Give it a time"}</h3>
      {!done && (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={complete}>
          <Check /> Complete
        </Button>
      )}
      {done && time.start ? (
        <>
          <p className="text-sm">
            {formatHuman(time.date)} · {formatTime(time.start)}–{formatTime(blockEnd({ ...time, start: time.start }))} · done, kept as record
          </p>
          {removeButton}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label="Day">
              <DatePicker required value={time.date} onChange={(d) => d && write({ ...time, date: d })} />
            </Field>
            <Field label="Start">
              <TimeField required={hasBlock} value={time.start ?? ""} onChange={(s) => s && write({ ...time, start: s })} />
            </Field>
          </div>
          {time.start ? (
            <>
              <QuickTiming
                step={SNAP_MIN}
                onNudge={(m) => write(blockNudged(time, m))}
                onTomorrow={time.date !== tomorrow ? () => write({ ...time, date: tomorrow }) : undefined}
                length={time.len}
                onLength={(m) => write(blockLasting(time, m))}
                lengthHint={`Ends ${formatTime(blockEnd({ ...time, start: time.start }))}`}
              />
              {hasBlock && removeButton}
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Pick a start to plan a block — the task stays where it is.</p>
          )}
        </>
      )}
    </section>
  );
}
