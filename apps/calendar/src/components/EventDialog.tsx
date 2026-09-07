import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { displayTitle, docHref, normalizeTag, todayStr, useLinkIndex, useTagVocabulary, type DateStr, type Handoff } from "@lifeline/core";
import type { Event } from "../domain/types";
import { addEvent, updateEvent } from "../data/repo";

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
  }, [open, event, defaultDate, handoff]);

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    if (!date) return void toast.error("Day required");
    if (!allDay && !start) return void toast.error("Start time required");
    if (!allDay && end && end < start) return void toast.error("End must be after start");
    if (allDay && endDate && endDate < date) return void toast.error("End day must be after the first day");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dentist"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ev-date">{allDay ? "First day" : "Day"}</Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {allDay ? (
              <div className="grid gap-2">
                <Label htmlFor="ev-end-date">Last day (optional)</Label>
                <Input
                  id="ev-end-date"
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="ev-start">Start</Label>
                  <Input id="ev-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ev-end">End</Label>
                  <Input id="ev-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
          </label>
          <div className="grid gap-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-tags">Tags</Label>
            <TagInput id="ev-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
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
