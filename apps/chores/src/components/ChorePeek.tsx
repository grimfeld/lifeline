import { useEffect, useState } from "react";
import { Button, toast } from "@lifeline/ui";
import { todayStr, type PeekProps } from "@lifeline/core";
import { Archive, ArchiveRestore, Check, Pause, Play } from "lucide-react";
import type { Chore } from "../domain/types";
import { isDoneOn } from "../domain/completions";
import { dueState } from "../domain/schedule";
import { draftOf, scheduleOf, type ScheduleDraft } from "../domain/scheduleDraft";
import { completeChore, lastDoneMap, rescheduleChore, setStatus, useCompletions } from "../data/repo";
import { DueBadge } from "./DueBadge";
import { ScheduleFields } from "./ScheduleFields";

const STATUS_LABEL: Record<Chore["status"], string> = { active: "Active", paused: "Paused", archived: "Archived" };

/**
 * Chores' editable Peek (ADR 0085): a Chore peeked from anywhere — a Day's
 * mention, a Base — with when it is due, its Schedule edited in place (saved
 * as soon as it reads as one), and its operations: done today, pause or
 * resume, archive or restore. Status and the interval anchor are guarded, so
 * they change only through those operations, never through a raw control.
 */
export function ChorePeek({ doc }: PeekProps) {
  const chore = doc as Chore;
  const completions = useCompletions();
  const today = todayStr();
  const due = dueState(chore, lastDoneMap(completions).get(chore.id) ?? null, today);
  const doneToday = isDoneOn(completions, chore.id, today);

  const saved = JSON.stringify(chore.schedule);
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftOf(chore.schedule));
  // Changed elsewhere (or our own save landing): the form follows, unless it already reads as it.
  useEffect(() => {
    setDraft((d) => {
      const read = scheduleOf(d);
      return read.ok && JSON.stringify(read.schedule) === saved ? d : draftOf(chore.schedule);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on `saved`, the schedule's value: the object itself changes identity on every read
  }, [saved]);
  const read = scheduleOf(draft);

  function edit(next: ScheduleDraft) {
    setDraft(next);
    const r = scheduleOf(next);
    if (r.ok && JSON.stringify(r.schedule) !== saved) void rescheduleChore(chore.id, r.schedule);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{STATUS_LABEL[chore.status] ?? chore.status}</span>
        {chore.status === "active" && <DueBadge due={due} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {chore.status === "active" && (
          <Button
            size="sm"
            variant={doneToday ? "secondary" : "default"}
            disabled={doneToday}
            onClick={() =>
              void completeChore(chore.id, today).then((recorded) => {
                if (recorded) toast.success(`${chore.title} done`);
                else toast.info(`${chore.title} was already done today`);
              })
            }
          >
            <Check /> {doneToday ? "Done today" : "Mark done"}
          </Button>
        )}
        {chore.status === "active" && (
          <Button size="sm" variant="outline" onClick={() => void setStatus(chore, "paused")}>
            <Pause /> Pause
          </Button>
        )}
        {chore.status === "paused" && (
          <Button size="sm" variant="outline" onClick={() => void setStatus(chore, "active")}>
            <Play /> Resume
          </Button>
        )}
        {chore.status !== "archived" ? (
          <Button size="sm" variant="outline" onClick={() => void setStatus(chore, "archived")}>
            <Archive /> Archive
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void setStatus(chore, "active")}>
            <ArchiveRestore /> Restore
          </Button>
        )}
      </div>
      <div className="grid gap-3">
        <ScheduleFields value={draft} onChange={edit} idPrefix="peek-chore-" error={read.ok ? undefined : read.error} />
      </div>
    </div>
  );
}
