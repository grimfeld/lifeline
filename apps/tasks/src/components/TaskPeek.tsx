import { useId, useState } from "react";
import { Button, CommitField, EstimatePicker, Field, TagInput, toast, useCommitDraft, usePushFlow } from "@lifeline/ui";
import { formatHuman, normalizeTag, pushSurfaceItem, todayStr, useTagVocabulary, type Document, type PeekProps } from "@lifeline/core";
import { Archive, ArchiveRestore, Check, Pencil, Repeat, Undo2 } from "lucide-react";
import type { Task } from "../domain/types";
import { describeRecurrence } from "../domain/occurrences";
import { editTask, moveItem, normalizeTask, setArchived, setCompleted, setEstimate, setTaskProject } from "../data/repo";
import { APP_ID } from "../schedulable";
import { DayPicker, ProjectPicker } from "./TaskFields";
import { TaskDialog } from "./TaskDialog";

/** Typed values are written a moment after the typing stops, as the Vault's editor writes. */
const WRITE_DELAY = 500;

/**
 * The Tasks App's part of a Task's Peek (ADR 0085): the Task's own Fields
 * edited where it was peeked — its day, Project, Estimate, notes and Tags —
 * and its operations (done, archive, push). The guarded ones change only
 * through the App's intents (`moveItem`, `setCompleted`, `setTaskProject`);
 * its recurrence through the Task dialog. The title, the user's own Fields and
 * the ways through are the Peek's frame's.
 */
export function TaskPeek({ doc }: PeekProps) {
  // Keyed by the Task: following a link to another one must not carry an edit over.
  return <TaskPeekPart key={doc.id} doc={doc} />;
}

function TaskPeekPart({ doc }: { doc: Document }) {
  const task = normalizeTask(doc as Task);
  const [editing, setEditing] = useState(false);
  const pushFlow = usePushFlow();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  // Its own ids: the Peek may sit over a page with the Task dialog's.
  const dayId = useId();
  const day = useCommitDraft(task.date ?? "", (d) => moveItem(task.id, d || null), { delay: WRITE_DELAY });
  const oneTime = !task.recurrence;
  const done = oneTime && !!task.completedOn;
  const archived = task.status === "archived";

  function push() {
    const item = { appId: APP_ID, itemId: task.id, date: task.date, estimateMin: task.estimate };
    pushFlow.push({ title: task.title, estimateMin: task.estimate, run: (min) => pushSurfaceItem(item, min) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {oneTime && (
          <Button size="sm" variant={done ? "outline" : "default"} onClick={() => void setCompleted(task.id, done ? null : todayStr())}>
            {done ? <Undo2 /> : <Check />}
            {done ? "Not done" : "Done"}
          </Button>
        )}
        {oneTime && !done && !archived && (
          <Button size="sm" variant="outline" onClick={push} title="Find this Task time in the Schedule">
            Push
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void setArchived(task, !archived);
            toast.success(archived ? "Task restored" : "Task archived");
          }}
        >
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? "Restore" : "Archive"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      </div>
      {done && task.completedOn && <p className="text-muted-foreground text-sm">Done {formatHuman(task.completedOn)}</p>}

      {oneTime ? (
        <DayPicker id={dayId} value={day.draft} error={day.error} onChange={day.change} />
      ) : (
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <Repeat className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0">{task.recurrence && describeRecurrence(task.recurrence)}</span>
        </p>
      )}

      <ProjectPicker
        current={task.project}
        project={task.project}
        milestone={task.milestone}
        onChange={(p, m) => void setTaskProject(task.id, p, m)}
      />

      <Field label="Estimate">
        <EstimatePicker value={task.estimate} onChange={(min) => void setEstimate(task.id, min)} />
      </Field>
      <CommitField label="Notes" multiline rows={3} delay={WRITE_DELAY} value={task.notes} placeholder="Optional" onCommit={(notes) => editTask(task.id, { notes })} />
      <Field label="Tags">
        <TagInput
          value={task.tags ?? []}
          onChange={(tags) => void editTask(task.id, { tags })}
          suggestions={suggestions}
          normalize={normalizeTag}
          placeholder="Add tag…"
        />
      </Field>
      <TaskDialog open={editing} onOpenChange={setEditing} task={task} />
      {pushFlow.dialog}
    </div>
  );
}
