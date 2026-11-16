import { useRef, useState } from "react";
import { Button, Checkbox, DatePicker, Field, formatLength, Tip, TimeField, toast } from "@lifeline/ui";
import {
  addDays,
  canRemoveTimed,
  canRescheduleTimed,
  closePeek,
  describeEnd,
  forgetTiming,
  formatHuman,
  formatTime,
  noteTiming,
  removeTimedItem,
  rescheduleTimedItem,
  spanLength,
  todayStr,
  type SurfaceTimedItem,
  type TimedWhen,
} from "@lifeline/core";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SNAP_MIN } from "../surfaces/hours";
import { contractWhen, timedAllDay, timedEndingAt, timedNudged, timedOnDay, timedStartingAt, timedWhenOf, type WhenTime } from "./timedTiming";

/** "Tue, Nov 10 · 10:00 – 11:00", "… · all day", or ending another day. */
function describeWhen(w: WhenTime): string {
  if (!w.start) return `${formatHuman(w.date)} · all day`;
  if (!w.end) return `${formatHuman(w.date)} · ${formatTime(w.start)}`;
  return `${formatHuman(w.date)} · ${formatTime(w.start)} – ${w.endDate !== w.date ? `${formatHuman(w.endDate)} ` : ""}${formatTime(w.end)}`;
}

/**
 * The **timing section** of a Peek opened from the hours on a Timed item its
 * App does not time in its own part (#538): a Time blocker band, another App's
 * item (a Workout Session, a Deadline, an Occasion). Above the App's part,
 * what was tapped — its day, its start (15 minutes earlier / later, Tomorrow)
 * and its end, the whole item from any of its pieces (ADR 0090) — written
 * through its App's Timed hooks (ADR 0056). Read-only where the App does not
 * reschedule (`canRescheduleTimed`), and for a weekly blocker, a rule.
 *
 * Every change is written at once and noted to the Peek (`noteTiming`), which
 * leaves one Undo on closing (#536). Delete acts at once with its own Undo.
 */
export function TimedTiming({ item }: { item: SurfaceTimedItem }) {
  const initial = useRef(timedWhenOf(item)).current;
  const [when, setWhen] = useState<WhenTime>(initial);
  const editable = canRescheduleTimed(item.appId) && !item.fixed;
  const key = `timed:${item.appId}/${item.itemId}`;

  const queue = useRef<Promise<void>>(Promise.resolve());
  const run = (f: () => Promise<unknown>) => {
    queue.current = queue.current.then(() => f()).then(
      () => undefined,
      (e: unknown) => void toast.error(`Could not save: ${e instanceof Error ? e.message : String(e)}`),
    );
  };

  function write(next: WhenTime) {
    setWhen(next);
    run(() => rescheduleTimedItem(item, contractWhen(next)));
    noteTiming<TimedWhen>({
      key,
      label: item.title,
      before: contractWhen(initial),
      after: contractWhen(next),
      restore: async () => {
        await queue.current;
        await rescheduleTimedItem(item, contractWhen(initial));
      },
    });
  }

  function remove() {
    forgetTiming(key);
    closePeek();
    run(async () => {
      const undo = await removeTimedItem(item);
      toast.success(`${item.title} deleted`, { action: { label: "Undo", onClick: () => void undo().catch((e: Error) => toast.error(`Could not bring it back: ${e.message}`)) } });
    });
  }

  const tomorrow = addDays(todayStr(), 1);
  const length = when.start && when.end ? spanLength({ ...when, start: when.start, end: when.end }) : null;
  const what = item.background ? "Time blocker" : item.title;
  const removable = canRemoveTimed(item);

  return (
    <section aria-label="Timing" className="grid gap-3 rounded-lg border p-3">
      <h3 className="text-muted-foreground min-w-0 text-sm font-medium break-words">{what}</h3>
      {editable ? (
        <>
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label="Day">
              <DatePicker required value={when.date} onChange={(d) => d && write(timedOnDay(when, d))} />
            </Field>
            {when.start && (
              <Field label="Start">
                <TimeField required value={when.start} onChange={(s) => s && write(timedStartingAt(when, s))} />
              </Field>
            )}
          </div>
          {when.start && (
            <Field label="End" hint={when.end && length !== null && length > 0 ? `${describeEnd({ ...when, end: when.end })} · ${formatLength(length)}` : undefined}>
              <TimeField value={when.end ?? ""} onChange={(e) => e && write(timedEndingAt(when, e))} />
            </Field>
          )}
          <div role="group" aria-label="Quick timing" className="flex flex-wrap items-center gap-1.5">
            {when.start && (
              <>
                <Tip label="15 minutes earlier">
                  <Button type="button" size="icon" variant="outline" onClick={() => write(timedNudged(when, -SNAP_MIN))}>
                    <Minus />
                  </Button>
                </Tip>
                <Tip label="15 minutes later">
                  <Button type="button" size="icon" variant="outline" onClick={() => write(timedNudged(when, SNAP_MIN))}>
                    <Plus />
                  </Button>
                </Tip>
              </>
            )}
            {when.date !== tomorrow && (
              <Button type="button" size="sm" variant="outline" onClick={() => write(timedOnDay(when, tomorrow))}>
                Tomorrow
              </Button>
            )}
          </div>
          {/* A band of blocked time is hours, never a whole day. */}
          {!item.background && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!when.start} onCheckedChange={(c) => write(c ? timedAllDay(when) : timedStartingAt(when, "09:00"))} /> All day
            </label>
          )}
        </>
      ) : (
        <>
          <p className="text-sm">{describeWhen(when)}</p>
          <p className="text-muted-foreground text-xs">{item.fixed ? "A weekly blocker is a rule — change it on the Events screen's Blockers tab." : "Its App keeps this time: it can't be moved from here."}</p>
        </>
      )}
      {removable && (
        <Button variant="ghost" size="sm" className="text-destructive justify-self-start" onClick={remove}>
          <Trash2 /> {item.background ? "Delete blocker" : "Delete"}
        </Button>
      )}
    </section>
  );
}
