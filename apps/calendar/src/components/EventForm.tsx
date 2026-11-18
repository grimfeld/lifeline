import { useId, useState, type MutableRefObject } from "react";
import { Field, TagInput, Textarea, useCommitDraft } from "@lifeline/ui";
import { noteTiming, normalizeTag, useTagVocabulary } from "@lifeline/core";
import { PeopleField } from "@lifeline/editor";
import type { Event } from "../domain/types";
import { whenFormErrors, whenOf, type EventDraft, type WhenForm, type WhenFormErrors } from "../domain/eventForm";
import { editEvent, setEventWhen } from "../data/repo";
import { WhenFields } from "./WhenFields";

export type { EventDraft } from "../domain/eventForm";

/**
 * The Calendar's one **Form** for an Event (CONTEXT.md, #530): the add dialog and
 * the Event's Peek draw the same Fields through it, so a Field added here shows
 * in both. Two modes:
 *
 * - **adding** — a draft: the caller holds it (`draft`, `onChange`) and saves it
 *   (the Event dialog's Add, also reached through the Event Intake). `errors`
 *   are the caller's to show, once saving has been tried.
 * - **editing** — an existing Event, written as it changes: its day and times
 *   through the guarded `setEventWhen` once they make an Event (`whenFormErrors`),
 *   its notes a moment after typing stops, With and Tags at once (`editEvent`).
 *   A change of day and times is noted to the Peek (`noteTiming`), which leaves
 *   one Undo for it on closing (ADR 0056, #536).
 *
 * `idPrefix` names its controls (`whenIds`, then `<prefix>notes`, `with` and
 * `tags`): the Peek may sit over a page with the dialog's. The user's own
 * Fields are not here: Core draws them under the Form in the Peek.
 */
export type EventFormProps =
  | { mode: "adding"; draft: EventDraft; onChange: (draft: EventDraft) => void; errors?: WhenFormErrors; idPrefix?: string }
  | { mode: "editing"; event: Event; idPrefix?: string; flushRef?: MutableRefObject<(() => Promise<void>) | null> };

export function EventForm(props: EventFormProps) {
  if (props.mode === "adding") {
    const { draft, onChange } = props;
    return <EventFields value={draft} onChange={({ when, ...rest }) => onChange({ ...draft, ...when, ...rest })} errors={props.errors} idPrefix={props.idPrefix} />;
  }
  // Keyed by the Event: following a link to another one must not carry an edit over.
  return <EditingForm key={props.event.id} event={props.event} idPrefix={props.idPrefix} flushRef={props.flushRef} />;
}

/** What the Peek's timing Undo knows an Event's day and times by. */
export const eventTimingKey = (id: string) => `event:${id}`;

/** Typed values are written a moment after the typing stops, as the Vault's editor writes. */
const WRITE_DELAY = 500;

/** Two forms of when are the same when every part is. */
const sameWhen = (a: WhenForm, b: WhenForm) => a.date === b.date && a.endDate === b.endDate && a.allDay === b.allDay && a.start === b.start && a.end === b.end;

/** An Event's day and times as the Form holds them; a timed one's usual hour offered when it stops being all day. */
function whenFormOf(e: Event): WhenForm {
  return {
    date: e.date || "",
    endDate: e.endDate || "",
    allDay: !e.start,
    start: e.start || "09:00",
    end: e.start ? e.end || "" : "10:00",
  };
}

function EditingForm({ event, idPrefix, flushRef }: { event: Event; idPrefix?: string; flushRef?: MutableRefObject<(() => Promise<void>) | null> }) {
  // Written once they make an Event; until then the half-made shape stays here, with what is wrong under it.
  const written = useCommitDraft(whenFormOf(event), (w) => setEventWhen(event.id, whenOf(w)), { delay: WRITE_DELAY, equals: sameWhen });
  const [unfinished, setUnfinished] = useState<WhenForm | null>(null);
  const notes = useCommitDraft(event.notes ?? "", (n) => editEvent(event.id, { notes: n }), { delay: WRITE_DELAY });
  // The Peek's Delete awaits what is still pending before it takes its snapshot.
  if (flushRef) flushRef.current = async () => void (await Promise.all([written.commit(), notes.commit()]));
  const when = unfinished ?? written.draft;
  const ownPrefix = useId();
  return (
    <EventFields
      idPrefix={idPrefix ?? ownPrefix}
      value={{ ...when, notes: notes.draft, with: event.with ?? [], tags: event.tags ?? [] }}
      // What the store refused shows under the day, with what is wrong with the form.
      errors={{ ...(written.error ? { date: written.error } : {}), ...whenFormErrors(when) }}
      onChange={(patch) => {
        if (patch.notes !== undefined) notes.change(patch.notes);
        if (patch.with !== undefined) void editEvent(event.id, { with: patch.with });
        if (patch.tags !== undefined) void editEvent(event.id, { tags: patch.tags });
        if (patch.when) {
          const next = patch.when;
          const ok = Object.keys(whenFormErrors(next)).length === 0;
          setUnfinished(ok ? null : next);
          if (ok) {
            written.change(next);
            const before = whenOf(whenFormOf(event));
            noteTiming({ key: eventTimingKey(event.id), label: event.title, before, after: whenOf(next), restore: () => setEventWhen(event.id, before) });
          }
        }
      }}
    />
  );
}

/** What one control changed: a when as a whole (the day and time controls move together), or one other Field. */
type FieldsPatch = Partial<Pick<EventDraft, "notes" | "with" | "tags">> & { when?: WhenForm };

/** The one set of controls, in the order both modes show them. */
function EventFields({
  value,
  onChange,
  errors = {},
  idPrefix = "ev-",
}: {
  value: EventDraft;
  onChange: (patch: FieldsPatch) => void;
  errors?: WhenFormErrors;
  idPrefix?: string;
}) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const { notes, with: withIds, tags, ...when } = value;
  return (
    <div role="group" aria-label="Event" className="grid gap-4">
      <WhenFields
        idPrefix={idPrefix}
        value={when}
        errors={errors}
        onChange={(w) => onChange({ when: w })}
      />
      <Field label="Notes">
        <Textarea id={`${idPrefix}notes`} value={notes} onChange={(e) => onChange({ notes: e.target.value })} rows={3} placeholder="Optional" />
      </Field>
      <Field label="With">
        <PeopleField id={`${idPrefix}with`} label="With" value={withIds} onChange={(ids) => onChange({ with: ids })} households />
      </Field>
      <Field label="Tags">
        <TagInput id={`${idPrefix}tags`} value={tags} onChange={(t) => onChange({ tags: t })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      </Field>
    </div>
  );
}
