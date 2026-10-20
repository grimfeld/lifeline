import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  TimeField,
  toast,
} from "@lifeline/ui";
import { normalizeTag, useTagVocabulary, type Weekday } from "@lifeline/core";
import { blockerSpan, isOvernight, WEEKDAYS } from "../domain/blockers";
import { whenFormErrors, type WhenForm, type WhenFormErrors } from "../domain/eventForm";
import { WhenFields } from "./WhenFields";
import type { TimeBlocker } from "../domain/types";
import { addTimeBlocker, updateTimeBlocker } from "../data/blockers";

/** The palette a band can be painted in; null = the Calendar App's colour. */
export const BLOCKER_COLORS: { value: string | null; label: string }[] = [
  { value: null, label: "Calendar" },
  { value: "var(--chart-blue)", label: "Blue" },
  { value: "var(--chart-aqua)", label: "Aqua" },
  { value: "var(--chart-green)", label: "Green" },
  { value: "var(--chart-yellow)", label: "Yellow" },
  { value: "var(--chart-orange)", label: "Orange" },
  { value: "var(--chart-red)", label: "Red" },
  { value: "var(--chart-magenta)", label: "Magenta" },
];

const QUICK_DAYS: { label: string; days: Weekday[] }[] = [
  { label: "Every day", days: [] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [6, 0] },
];

export function TimeBlockerDialog({
  open,
  onOpenChange,
  blocker,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  blocker?: TimeBlocker;
}) {
  const [title, setTitle] = useState("");
  /** A one-off blocker (ADR 0029) keeps its span here, as the Event form holds one (ADR 0090); a weekly one has none. */
  const [when, setWhen] = useState<WhenForm | null>(null);
  const [whenErrors, setWhenErrors] = useState<WhenFormErrors>({});
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [color, setColor] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setTitle(blocker?.title ?? "");
    const span = blocker ? blockerSpan(blocker) : null;
    setWhen(span && { date: span.date, endDate: span.endDate === span.date ? "" : span.endDate, allDay: false, start: span.start, end: span.end });
    setWhenErrors({});
    setWeekdays(blocker?.weekdays ?? []);
    setStart(blocker?.start ?? "09:00");
    setEnd(blocker?.end ?? "17:00");
    setColor(blocker?.color ?? null);
    setActive(blocker ? blocker.active !== false : true);
    setTags(blocker?.tags ?? []);
  }, [open, blocker]);

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    let fields;
    if (when) {
      // A one-off band is a span (ADR 0090): its End after its Start, the end day included.
      const errors: WhenFormErrors = { ...whenFormErrors(when), ...(when.end ? {} : { end: "End time required" }) };
      setWhenErrors(errors);
      if (Object.keys(errors).length) return;
      fields = { title: title.trim(), date: when.date, endDate: when.endDate || when.date, weekdays: [], start: when.start, end: when.end, color, active, tags };
    } else {
      if (!start || !end) return void toast.error("Start and end required");
      fields = { title: title.trim(), date: null, endDate: null, weekdays, start, end, color, active, tags };
    }
    if (blocker) {
      await updateTimeBlocker({ ...blocker, ...fields });
      toast.success("Blocker updated");
    } else {
      await addTimeBlocker(fields);
      toast.success("Blocker added");
    }
    onOpenChange(false);
  }

  const overnight = isOvernight({ start, end });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{blocker ? (blocker.date ? "Edit one-off blocker" : "Edit time blocker") : "New time blocker"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="blk-title">Title</Label>
            <Input
              id="blk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Work"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          {when ? (
            <>
              <WhenFields value={when} onChange={setWhen} errors={whenErrors} idPrefix="blk-" canAllDay={false} />
              <p className="text-muted-foreground text-xs">A one-off band, on these days only. Drag it on the Schedule to move it.</p>
            </>
          ) : (
            <>
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
                      className={cn("rounded-md border px-2.5 py-1 text-sm transition-colors", on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
                      onClick={() => setWeekdays((cur) => (on ? cur.filter((x) => x !== wd.value) : [...cur, wd.value]))}
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DAYS.map((q) => (
                  <Button key={q.label} type="button" size="xs" variant="ghost" onClick={() => setWeekdays(q.days)}>
                    {q.label}
                  </Button>
                ))}
              </div>
              {weekdays.length === 0 && <p className="text-muted-foreground text-xs">No day picked — the band covers every day.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="blk-start">Start</Label>
                <TimeField id="blk-start" required value={start} onChange={setStart} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blk-end">End</Label>
                <TimeField id="blk-end" required value={end} onChange={setEnd} />
              </div>
            </div>
            {overnight && <p className="text-muted-foreground text-xs">Runs past midnight: the band ends the next morning.</p>}
            </>
          )}
          <div className="grid gap-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-1.5">
              {BLOCKER_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  title={c.label}
                  className={cn("size-6 rounded-full border-2", color === c.value ? "border-foreground" : "border-transparent")}
                  style={{ background: c.value ?? "var(--chart-violet)" }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} /> Painted on the Schedule
          </label>
          <div className="grid gap-2">
            <Label htmlFor="blk-tags">Tags</Label>
            <TagInput id="blk-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{blocker ? "Save" : "Add blocker"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
