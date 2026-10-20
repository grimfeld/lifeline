import { useEffect, useState } from "react";
import {
  Button,
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
import { displayTitle, docHref, normalizeTag, todayStr, useLinkIndex, useTagVocabulary, type DateStr, type Handoff, type IntakePrefill } from "@lifeline/core";
import type { Event } from "../domain/types";
import { addEvent, updateEvent } from "../data/repo";
import { eventFormErrors, newEventWhen, whenOf, withEnd, withStart, type EventFormErrors } from "../domain/eventForm";
import { EventWhenFields, whenIds } from "./EventWhenFields";

/** Each checked control's id — its input's and the one an error focuses — in the order the dialog shows them. */
const FIELD_IDS: Record<keyof EventFormErrors, string> = { title: "ev-title", ...whenIds("ev-") };

/**
 * What a new Event starts with, from whoever opens the dialog (the Schedule's
 * quick add's "More…", through the Intake contract): its title, day, start,
 * end day and end. Whatever is left out takes the usual default.
 */
export type EventPrefill = IntakePrefill;

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  handoff,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  event?: Event;
  defaultDate?: DateStr;
  /** Create mode, Intake (ADR 0050): the title and the origin; the day and time are asked here. */
  handoff?: Handoff;
  /** Create mode: what is already known of the new Event; it beats `defaultDate` and the Handoff's title. */
  prefill?: EventPrefill;
  /** Create mode: called with the new Event once it is saved (the Intake contract). */
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string>(todayStr());
  const [endDate, setEndDate] = useState<string>("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [tags, setTags] = useState<string[]>([]);
  /** Errors show once saving has been tried, and clear as each field is fixed. */
  const [tried, setTried] = useState(false);
  const errors = tried ? eventFormErrors({ title, date, endDate, allDay, start, end }) : {};
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const linkIndex = useLinkIndex();
  const backlinks = event ? linkIndex.backlinksTo(event.id) : [];

  // The prefill's parts, not the object: a caller passing a fresh one each render must not reset what is typed.
  const { title: preTitle, date: preDate, start: preStart, endDate: preEndDate, end: preEnd } = prefill ?? {};
  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? preTitle ?? handoff?.title ?? "");
    setNotes(event?.notes ?? (handoff ? [handoff.url, handoff.author ? `From ${handoff.author}` : ""].filter(Boolean).join("\n") : ""));
    setTags(event?.tags ?? []);
    setTried(false);
    if (event) {
      setDate(event.date);
      setEndDate(event.endDate ?? "");
      setAllDay(event.start === null);
      setStart(event.start ?? "09:00");
      setEnd(event.end ?? "10:00");
      return;
    }
    // A new Event is timed: at the next quarter hour today, 09:00 another day, lasting an hour.
    const day = preDate ?? defaultDate ?? todayStr();
    // A given start keeps its day, and an hour's length (into the next day when late) unless an end is given too.
    const timed = preStart ? withStart({ date: day, start: "09:00", endDate: "", end: "10:00" }, preStart) : newEventWhen(day);
    // A given end without its day rolls past midnight as one typed would (ADR 0090).
    const ended = preEnd ? (preEndDate ? { ...timed, endDate: preEndDate, end: preEnd } : withEnd(timed, preEnd)) : timed;
    setDate(ended.date);
    setEndDate(ended.endDate === ended.date ? "" : ended.endDate);
    setAllDay(false);
    setStart(ended.start);
    setEnd(ended.end);
  }, [open, event, defaultDate, handoff, preTitle, preDate, preStart, preEndDate, preEnd]);

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
      ...whenOf({ date, endDate, allDay, start, end }),
      tags,
    };
    if (event) {
      await updateEvent({ ...event, ...fields });
      toast.success("Event updated");
    } else {
      const id = await addEvent(fields);
      toast.success("Event added");
      onSaved?.(id);
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
          <EventWhenFields
            value={{ date, endDate, allDay, start, end }}
            errors={errors}
            onChange={(w) => {
              setDate(w.date);
              setEndDate(w.endDate);
              setAllDay(w.allDay);
              setStart(w.start);
              setEnd(w.end);
            }}
          />
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
