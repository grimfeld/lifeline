import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { displayTitle, docHref, normalizeTag, todayStr, useLinkIndex, useTagVocabulary, type DateStr, type Handoff } from "@lifeline/core";
import type { Event } from "../domain/types";
import { addEvent, updateEvent } from "../data/repo";
import { eventFormErrors, type EventFormErrors } from "../domain/eventForm";

/** Each checked control's id — its input's and the one an error focuses — in the order the dialog shows them. */
const FIELD_IDS: Record<keyof EventFormErrors, string> = {
  title: "ev-title",
  date: "ev-date",
  endDate: "ev-end-date",
  start: "ev-start",
  end: "ev-end",
};

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  handoff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  event?: Event;
  defaultDate?: DateStr;
  /** Create mode, Intake (ADR 0050): the title and the origin; the day and time are asked here. */
  handoff?: Handoff;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string>(todayStr());
  const [endDate, setEndDate] = useState<string>("");
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [tags, setTags] = useState<string[]>([]);
  /** Errors show once saving has been tried, and clear as each field is fixed. */
  const [tried, setTried] = useState(false);
  const errors = tried ? eventFormErrors({ title, date, endDate, allDay, start, end }) : {};
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const linkIndex = useLinkIndex();
  const backlinks = event ? linkIndex.backlinksTo(event.id) : [];

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? handoff?.title ?? "");
    setNotes(event?.notes ?? (handoff ? [handoff.url, handoff.author ? `From ${handoff.author}` : ""].filter(Boolean).join("\n") : ""));
    setDate(event?.date ?? defaultDate ?? todayStr());
    setEndDate(event?.endDate ?? "");
    setAllDay(event ? event.start === null : true);
    setStart(event?.start ?? "09:00");
    setEnd(event?.end ?? "10:00");
    setTags(event?.tags ?? []);
    setTried(false);
  }, [open, event, defaultDate, handoff]);

  async function submit() {
    const invalid = Object.keys(eventFormErrors({ title, date, endDate, allDay, start, end }));
    if (invalid.length) {
      setTried(true);
      const first = (Object.keys(FIELD_IDS) as (keyof EventFormErrors)[]).find((k) => invalid.includes(k));
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    const fields = {
      title: title.trim(),
      notes: notes.trim(),
      date,
      endDate: allDay && endDate && endDate > date ? endDate : null,
      start: allDay ? null : start,
      end: allDay ? null : end || null,
      tags,
    };
    if (event) {
      await updateEvent({ ...event, ...fields });
      toast.success("Event updated");
    } else {
      await addEvent(fields);
      toast.success("Event added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {e.preventDefault();}}>
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" error={errors.title}>
            <Input
              id={FIELD_IDS.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dentist"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </Field>
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label={allDay ? "First day" : "Day"} error={errors.date}>
              <Input id={FIELD_IDS.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {allDay ? (
              <Field label="Last day (optional)" error={errors.endDate}>
                <Input
                  id={FIELD_IDS.endDate}
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-2 items-start gap-2">
                <Field label="Start" error={errors.start}>
                  <Input id={FIELD_IDS.start} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="End" error={errors.end}>
                  <Input id={FIELD_IDS.end} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
          </label>
          <Field label="Notes">
            <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
          </Field>
          <Field label="Tags">
            <TagInput id="ev-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </Field>
          {event && backlinks.length > 0 && (
            <div className="text-muted-foreground grid gap-1 text-xs">
              <span>
                Mentioned in {backlinks.length} {backlinks.length === 1 ? "note" : "notes"}
              </span>
              <ul className="grid gap-0.5">
                {backlinks.map((b) => {
                  const src = linkIndex.byId.get(b.sourceId);
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
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{event ? "Save" : "Add event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
