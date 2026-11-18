import { useReducer, useRef } from "react";
import { Button, DatePicker, Field, QuickTiming, TimeField, toast, toastWithUndo } from "@lifeline/ui";
import { addDays, closePeek, formatHuman, formatTime, SNAP_MIN, todayStr, type HoursTapped } from "@lifeline/core";
import { Check, Trash2 } from "lucide-react";
import { blockEnd, blockLasting, blockNudged, type BlockTime } from "./blockTiming";
import { blockVisit } from "./peekVisit";
import { useMoveDialog, useWorkActions } from "../surfaces/WorkMenu";

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
  // The row's own actions, as Month's and Upcoming's right-click menu has them: the way a phone reaches them.
  // A chip's day is the item's own, so Move and Unplace act on it; a block's day is the section's Day.
  // Each acts on the item as tapped, so the Peek closes once it has.
  const move = useMoveDialog(todayStr(), closePeek);
  const isBlock = !!(item.placementId && item.start);
  const actions = useWorkActions(item, move.start).filter((a) => a.id !== "complete" && (!isBlock || a.id === "push"));
  const act = (a: (typeof actions)[number]) => {
    if (a.id === "move") return a.run();
    closePeek();
    a.run();
  };

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
      {(!done || actions.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {!done && (
            <Button variant="outline" size="sm" onClick={complete}>
              <Check /> Complete
            </Button>
          )}
          {actions.map((a) => (
            <Button key={a.id} variant="outline" size="sm" onClick={() => act(a)}>
              {a.icon} {a.label}
            </Button>
          ))}
        </div>
      )}
      {move.dialog}
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
