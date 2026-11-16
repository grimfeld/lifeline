import { useRef, useState } from "react";
import { Button, DatePicker, Field, QuickTiming, TimeField, toast } from "@lifeline/ui";
import {
  addDays,
  addTimeBlock,
  forgetTiming,
  formatHuman,
  formatTime,
  moveTimeBlock,
  noteTiming,
  removeTimeBlock,
  SNAP_MIN,
  todayStr,
  unplaceItem,
  type WorkOnHours,
} from "@lifeline/core";
import { Trash2 } from "lucide-react";
import { useWriteQueue } from "./useWriteQueue";
import { blockEnd, blockLasting, blockNudged, blockOfTapped, type BlockTime } from "./blockTiming";

/** A Time block's timing as the Peek's Undo knows it. */
type Placed = { date: string; start: string; end: string };
const placed = (b: BlockTime & { start: string }): Placed => ({ date: b.date, start: b.start, end: blockEnd(b) });

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
 * at once with its own Undo.
 */
export function BlockTiming({ item }: { item: WorkOnHours }) {
  const initial = useRef(blockOfTapped(item, todayStr())).current;
  const [time, setTime] = useState<BlockTime>(initial);
  const blockId = useRef<string | null>(item.placementId && item.start ? item.placementId : null);
  const [hasBlock, setHasBlock] = useState(blockId.current !== null);
  /** The block this visit made from the chip, until it is removed. */
  const made = useRef(false);
  const done = !!item.completedOn;

  // Writes run in order: a quick second nudge must not race the block the first one made.
  const { run, settled } = useWriteQueue();
  const timingKey = () => (made.current || !item.placementId ? `block:chip:${item.appId}/${item.itemId}` : `block:${item.placementId}`);

  function write(next: BlockTime) {
    setTime(next);
    // An untimed chip only chooses where its block will land until it has a start.
    if (!next.start) return;
    const at = placed({ ...next, start: next.start });
    const span = { start: at.start, end: at.end };
    if (blockId.current) {
      const id = blockId.current;
      run(() => moveTimeBlock(id, next.date, span));
    } else {
      made.current = true;
      setHasBlock(true);
      run(async () => {
        blockId.current = await addTimeBlock(item.appId, item.itemId, next.date, span);
      });
    }
    const before = initial.start && !made.current ? placed({ ...initial, start: initial.start }) : null;
    noteTiming<Placed | null>({
      key: timingKey(),
      label: item.title,
      before,
      after: at,
      restore: async () => {
        await settled();
        const id = blockId.current;
        if (!id) return;
        if (before) await moveTimeBlock(id, before.date, { start: before.start, end: before.end });
        else await unplaceItem(id);
      },
    });
  }

  function remove() {
    forgetTiming(timingKey());
    setHasBlock(false);
    setTime((t) => ({ ...t, start: null }));
    run(async () => {
      const id = blockId.current;
      if (!id) return;
      blockId.current = null;
      const undo = await removeTimeBlock(id);
      toast.success("Block removed — the task stays", { action: { label: "Undo", onClick: () => void undo().catch((e: Error) => toast.error(`Could not bring it back: ${e.message}`)) } });
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
    <section aria-label="Time block" className="grid gap-3 rounded-lg border p-3">
      <h3 className="text-muted-foreground text-sm font-medium">{hasBlock ? "Time block" : "Give it a time"}</h3>
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
