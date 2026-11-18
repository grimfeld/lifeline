import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { initialList, initialText, todayStr, type DateStr, type Handoff, type IntakePrefill } from "@lifeline/core";
import { addEvent } from "../data/repo";
import { eventFormErrors, newEventWhen, whenOf, withEnd, withStart, type EventFormErrors, type WhenForm } from "../domain/eventForm";
import { fillFromTemplate } from "../domain/templates";
import { useEventTemplates } from "../data/templates";
import { EventForm, type BlockerPick, type EventDraft } from "./EventForm";
import { PlaceHere } from "./PlaceHere";
import { whenIds } from "./WhenFields";

/** Each checked control's id — its input's and the one an error focuses — in the order the dialog shows them. */
const FIELD_IDS: Record<keyof EventFormErrors, string> = { title: "ev-title", ...whenIds("ev-") };

/** A new Event's draft: timed, at the next quarter hour today or 09:00 another day, lasting an hour — unless the prefill says otherwise. */
function newDraft(day: DateStr, pre: Partial<Pick<IntakePrefill, "start" | "endDate" | "end">>): WhenForm {
  // A given start keeps its day, and an hour's length (into the next day when late) unless an end is given too.
  const timed = pre.start ? withStart({ date: day, start: "09:00", endDate: "", end: "10:00" }, pre.start) : newEventWhen(day);
  // A given end without its day rolls past midnight as one typed would (ADR 0090).
  const ended = pre.end ? (pre.endDate ? { ...timed, endDate: pre.endDate, end: pre.end } : withEnd(timed, pre.end)) : timed;
  return { date: ended.date, endDate: ended.endDate === ended.date ? "" : ended.endDate, allDay: false, start: ended.start, end: ended.end };
}

/**
 * Adds an Event: the Event templates (#535), its title and the Event Form in
 * adding mode (#532), then "Or place here" (#539) — a Blocker template or
 * unplaced work at the Form's day and start instead. An existing Event is
 * never edited here — that is its Peek's, through the same Form.
 */
export function EventDialog({
  open,
  onOpenChange,
  defaultDate,
  handoff,
  prefill,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: DateStr;
  /** Intake (ADR 0050): the title and the origin; the day and time are asked here. */
  handoff?: Handoff;
  /** What is already known of the new Event (an empty hour or a swept range of the Schedule, through the Intake contract): its title, day, start, end day and end. It beats `defaultDate` and the Handoff's title; whatever is left out takes the usual default. */
  prefill?: IntakePrefill;
  /** The palette's inline line (CommandDialogProps.initial): the notes and Tags it understood beside the `prefill`. */
  initial?: Record<string, unknown>;
  /** Called with the new Event once it is saved (the Intake contract). */
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<EventDraft>(() => ({ ...newDraft(todayStr(), {}), notes: "", with: [], at: "", tags: [] }));
  /** Blockers picked from Before…/After…, attached when the Event is added (#497). */
  const [picks, setPicks] = useState<BlockerPick[]>([]);
  /** Errors show once saving has been tried, and clear as each field is fixed. */
  const [tried, setTried] = useState(false);
  const templates = useEventTemplates();
  const errors = tried ? eventFormErrors({ title, ...draft }) : {};

  // The prefill's parts, not the object: a caller passing a fresh one each render must not reset what is typed.
  const { title: preTitle, date: preDate, start: preStart, endDate: preEndDate, end: preEnd } = prefill ?? {};
  useEffect(() => {
    if (!open) return;
    setTitle(preTitle ?? handoff?.title ?? "");
    setPicks([]);
    setTried(false);
    setDraft({
      ...newDraft(preDate ?? defaultDate ?? todayStr(), { start: preStart, endDate: preEndDate, end: preEnd }),
      notes: handoff ? [handoff.url, handoff.author ? `From ${handoff.author}` : ""].filter(Boolean).join("\n") : initialText(initial, "notes"),
      with: [],
      at: "",
      tags: initialList(initial, "tags"),
    });
  }, [open, defaultDate, handoff, initial, preTitle, preDate, preStart, preEndDate, preEnd]);

  /** Picking an Event template fills the Form (#535) and saves nothing: the start the dialog was given beats the template's usual one. */
  function pick(t: (typeof templates)[number]) {
    const filled = fillFromTemplate(t, { ...draft, title }, preStart);
    const { title: pickedTitle, ...rest } = filled;
    setTitle(pickedTitle);
    setDraft(rest);
  }

  async function submit() {
    const invalid = Object.keys(eventFormErrors({ title, ...draft }));
    if (invalid.length) {
      setTried(true);
      const first = (Object.keys(FIELD_IDS) as (keyof EventFormErrors)[]).find((k) => invalid.includes(k));
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    // An all-day Event takes no attached blockers: what was picked before it was made all day is dropped.
    const attach = draft.allDay ? [] : picks.map((p) => ({ templateId: p.template.id, side: p.side }));
    const id = await addEvent({ title: title.trim(), notes: draft.notes.trim(), ...whenOf(draft), tags: draft.tags, with: draft.with, at: draft.at, attach });
    toast.success("Event added");
    onSaved?.(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* At desk width the kit's dialog grows with what it holds; templates, the Form and "Or place here" can outgrow
          the window, so it stops 1rem short of each edge (the kit's own side margin) and scrolls. A phone's is full screen already. */}
      <DialogContent className="sm:max-w-md md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto" onInteractOutside={(e) => {e.preventDefault();}}>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription className="sr-only">Give it a title and a time, start from a template, or place a Blocker template or unplaced work here instead.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {templates.length > 0 && (
            <div role="group" aria-label="Event templates" className="grid gap-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                <LayoutTemplate className="size-3.5" /> From a template
              </span>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {templates.map((t) => (
                  <Button key={t.id} type="button" size="sm" variant="outline" className="h-auto min-w-0 max-w-full py-1" onClick={() => pick(t)}>
                    <span className="min-w-0 break-words whitespace-normal text-left [overflow-wrap:anywhere]">{t.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
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
          <EventForm mode="adding" draft={draft} onChange={setDraft} errors={errors} idPrefix="ev-" picks={picks} onPicks={setPicks} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Add event</Button>
        </DialogFooter>
        <PlaceHere date={draft.date || todayStr()} start={draft.allDay ? null : draft.start || null} onPlaced={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
