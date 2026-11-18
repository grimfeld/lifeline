import { Button, Checkbox, DatePicker, Field, formatLength, QuickTiming, TimeField } from "@lifeline/ui";
import {
  addDays,
  canMoveTimed,
  canRemoveTimed,
  canRescheduleTimed,
  closePeek,
  describeEnd,
  describeDayAndTime,
  SNAP_MIN,
  spanLength,
  todayStr,
  type HoursTapped,
  type WholeWhen,
} from "@lifeline/core";
import { Trash2 } from "lucide-react";
import { timedVisit } from "./peekVisit";
import { offerUndo, useRedraw } from "./visitSection";
import { timedControls, timedAllDay, timedEndingAt, timedNudged, timedOnDay, timedStartingAt } from "./timedTiming";

/**
 * The **timing section** of a Peek opened from the hours on a Timed item its
 * App does not time in its own part (#538): a Time blocker band, another App's
 * item (a Workout Session, a Deadline, an Occasion). Above the App's part,
 * what was tapped — its day, its start (15 minutes earlier / later, Tomorrow)
 * and its end, the whole item from any of its pieces (ADR 0090) — written
 * through its App's Timed hooks (ADR 0056), as far as the App allows
 * (`timedControls`): only its day where the App moves but does not reschedule
 * (a Deadline); read-only where it does neither, and for a weekly blocker, a rule.
 *
 * Every change is written at once and noted to the Peek (`noteTiming`), which
 * leaves one Undo on closing (#536). Delete acts at once with its own Undo.
 * The when is the visit's (`timedVisit`), kept while the Peek is open.
 */
export function TimedTiming({ tapped }: { tapped: HoursTapped & { kind: "timed" } }) {
  const item = tapped.item;
  // The visit keeps the when, so Back from a link shows what was last written (F1).
  const visit = timedVisit(tapped);
  const redraw = useRedraw();
  const { when } = visit;
  // The visit writes through the hook the App has: a reschedule writes the whole when, a move only the day.
  const controls = timedControls(item, { reschedule: canRescheduleTimed(item.appId), move: canMoveTimed(item.appId) });

  function write(next: WholeWhen) {
    visit.write(next);
    redraw();
  }

  function remove() {
    const removed = visit.remove();
    closePeek();
    offerUndo(`${item.title} deleted`, removed);
  }

  const tomorrow = addDays(todayStr(), 1);
  const length = when.start && when.end ? spanLength({ ...when, start: when.start, end: when.end }) : null;
  const what = item.background ? "Time blocker" : item.title;
  const removable = canRemoveTimed(item);

  return (
    <section aria-label="Timing" className="grid gap-3 rounded-lg border p-3">
      <h3 className="text-muted-foreground min-w-0 text-sm font-medium break-words">{what}</h3>
      {controls !== "none" ? (
        <>
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label="Day">
              <DatePicker required value={when.date} onChange={(d) => d && write(timedOnDay(when, d))} />
            </Field>
            {controls === "retime" && when.start && (
              <Field label="Start">
                <TimeField required value={when.start} onChange={(s) => s && write(timedStartingAt(when, s))} />
              </Field>
            )}
          </div>
          {controls === "retime" && when.start && (
            <Field label="End" hint={when.end && length !== null && length > 0 ? `${describeEnd({ ...when, end: when.end })} · ${formatLength(length)}` : undefined}>
              <TimeField value={when.end ?? ""} onChange={(e) => e && write(timedEndingAt(when, e))} />
            </Field>
          )}
          <QuickTiming
            step={SNAP_MIN}
            onNudge={controls === "retime" && when.start ? (m) => write(timedNudged(when, m)) : undefined}
            onTomorrow={when.date !== tomorrow ? () => write(timedOnDay(when, tomorrow)) : undefined}
          />
          {/* A band of blocked time is hours, never a whole day. */}
          {controls === "retime" && !item.background && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!when.start} onCheckedChange={(c) => write(c ? timedAllDay(when) : timedStartingAt(when, "09:00"))} /> All day
            </label>
          )}
        </>
      ) : (
        <>
          <p className="text-sm">{describeDayAndTime(when)}</p>
          <p className="text-muted-foreground text-xs">{item.fixed ? "A weekly blocker is a rule — change it on the Events screen's Blockers tab." : "Its App keeps this time: it can't be moved from here."}</p>
        </>
      )}
      {removable && (
        <Button variant="destructive" size="sm" className="justify-self-start" onClick={remove}>
          <Trash2 /> {item.background ? "Delete blocker" : "Delete"}
        </Button>
      )}
    </section>
  );
}
