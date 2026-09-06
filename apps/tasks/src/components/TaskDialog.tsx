import { useEffect, useState } from "react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import {
  normalizeTag,
  todayStr,
  useBacklinks,
  useLinkIndex,
  displayTitle,
  docHref,
  useTagVocabulary,
  type DateStr,
  type Handoff,
  type Weekday,
} from "@lifeline/core";
import type { Recurrence, Task } from "../domain/types";
import { addTask, updateTask } from "../data/repo";

/** Monday-first display order; values are Core weekdays (0 = Sunday). */
export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type Kind = "one-time" | "weekly" | "monthly" | "yearly";

/** A Task made from a Handoff keeps only the origin: the text stays where it came from. */
function handoffNotes(h: Handoff): string {
  return [h.url, h.author ? `From ${h.author}` : ""].filter(Boolean).join("\n");
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Notes that link to this Task (edit mode only). Hidden when there are none. */
function MentionedIn({ taskId }: { taskId: string }) {
  const backlinks = useBacklinks(taskId);
  const idx = useLinkIndex();
  if (backlinks.length === 0) return null;
  return (
    <div className="text-muted-foreground grid gap-1 text-xs">
      <span>Mentioned in {backlinks.length} {backlinks.length === 1 ? "document" : "documents"}</span>
      <ul className="grid gap-0.5">
        {backlinks.map((b) => {
          const src = idx.byId.get(b.sourceId);
          const title = src ? displayTitle(src) : b.sourceId;
          return (
            <li key={`${b.sourceId}/${b.field ?? ""}`} className="truncate">
              {src ? (
                <a href={docHref(src)} className="hover:text-foreground underline-offset-2 hover:underline">
                  {title}
                </a>
              ) : (
                title
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultDate,
  handoff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  task?: Task;
  /** Create mode: preselected day (null = Unassigned). */
  defaultDate?: DateStr | null;
  /** Create mode, Intake (ADR 0046): the title, and the origin in the notes. */
  handoff?: Handoff;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<Kind>("one-time");
  const [date, setDate] = useState<string>("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([1]);
  const [monthDays, setMonthDays] = useState<number[]>([1]);
  const [yearDates, setYearDates] = useState<{ month: number; day: number }[]>([{ month: 1, day: 1 }]);
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? handoff?.title ?? "");
    setNotes(task?.notes ?? (handoff ? handoffNotes(handoff) : ""));
    const r = task?.recurrence ?? null;
    setKind(r ? r.kind : "one-time");
    setDate(task ? (task.date ?? "") : (defaultDate === undefined ? todayStr() : (defaultDate ?? "")));
    setWeekdays(r?.kind === "weekly" ? r.weekdays : [1]);
    setMonthDays(r?.kind === "monthly" ? r.days : [1]);
    setYearDates(r?.kind === "yearly" ? r.dates : [{ month: 1, day: 1 }]);
    setTags(task?.tags ?? []);
  }, [open, task, defaultDate, handoff]);

  function buildRecurrence(): Recurrence | null {
    if (kind === "weekly") return { kind: "weekly", weekdays: [...weekdays].sort() };
    if (kind === "monthly") return { kind: "monthly", days: Array.from(new Set(monthDays)).sort((a, b) => a - b) };
    if (kind === "yearly") {
      const seen = new Set<string>();
      const dates = yearDates.filter((d) => {
        const k = `${d.month}-${d.day}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { kind: "yearly", dates: dates.sort((a, b) => a.month - b.month || a.day - b.day) };
    }
    return null;
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    if (kind === "weekly" && weekdays.length === 0) {
      toast.error("Pick at least one weekday");
      return;
    }
    if (kind === "monthly" && monthDays.length === 0) {
      toast.error("Pick at least one day of the month");
      return;
    }
    if (kind === "yearly" && yearDates.length === 0) {
      toast.error("Add at least one date");
      return;
    }
    const recurrence = buildRecurrence();
    if (task) {
      await updateTask({
        ...task,
        title: title.trim(),
        notes: notes.trim(),
        recurrence,
        date: recurrence ? null : date || null,
        completedOn: recurrence ? null : task.completedOn,
        tags,
      });
      toast.success("Task updated");
    } else {
      await addTask({ title: title.trim(), notes: notes.trim(), recurrence, date: date || null, tags });
      toast.success("Task added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call the dentist"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="weekly">Weekly recurring</SelectItem>
                <SelectItem value="monthly">Monthly recurring</SelectItem>
                <SelectItem value="yearly">Yearly recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "one-time" ? (
            <div className="grid gap-2">
              <Label htmlFor="task-date">Day</Label>
              <div className="flex gap-2">
                <Input
                  id="task-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Button
                  type="button"
                  variant={date ? "outline" : "secondary"}
                  onClick={() => setDate("")}
                >
                  Unassigned
                </Button>
              </div>
              {!date && (
                <p className="text-muted-foreground text-xs">
                  Stays in the Unassigned pool until you drop it on a day.
                </p>
              )}
            </div>
          ) : kind === "weekly" ? (
            <div className="grid gap-2">
              <Label>Repeats on</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((wd) => {
                  const on = weekdays.includes(wd.value);
                  return (
                    <button
                      key={wd.value}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-sm transition-colors",
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent",
                      )}
                      onClick={() =>
                        setWeekdays((cur) =>
                          on ? cur.filter((x) => x !== wd.value) : [...cur, wd.value],
                        )
                      }
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : kind === "monthly" ? (
            <div className="grid gap-2">
              <Label>Days of the month</Label>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                  const on = monthDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      className={cn("rounded-md border py-1 text-sm tabular-nums transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
                      onClick={() => setMonthDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">The 29th–31st fall on the last day of shorter months.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Dates in the year</Label>
              <div className="grid gap-1">
                {yearDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Select value={String(d.month)} onValueChange={(v) => setYearDates((cur) => cur.map((x, j) => (j === i ? { ...x, month: Number(v) } : x)))}>
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, k) => (
                          <SelectItem key={m} value={String(k + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="h-8 w-20"
                      value={d.day}
                      onChange={(e) => {
                        const n = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                        setYearDates((cur) => cur.map((x, j) => (j === i ? { ...x, day: n } : x)));
                      }}
                      aria-label="Day"
                    />
                    <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setYearDates((cur) => cur.filter((_, j) => j !== i))} disabled={yearDates.length === 1} aria-label="Remove date">
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => setYearDates((cur) => [...cur, { month: 1, day: 1 }])}>
                + Add a date
              </Button>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-tags">Tags</Label>
            <TagInput
              id="task-tags"
              value={tags}
              onChange={setTags}
              suggestions={suggestions}
              normalize={normalizeTag}
              placeholder="Add tag…"
            />
          </div>
          {task && <MentionedIn taskId={task.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{task ? "Save" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
