import { useState } from "react";
import { Field, TagInput, Textarea, useSoonWritten } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary, type Document, type PeekProps } from "@lifeline/core";
import type { Event } from "../domain/types";
import { eventFormErrors, whenOf } from "../domain/eventForm";
import { editEvent, setEventWhen } from "../data/repo";
import { EventWhenFields, type WhenForm } from "./EventWhenFields";

/** Ids of the Peek's controls: it may sit over a page with the Event dialog's own. */
const ID = "peek-ev-";

/** An Event's day and times as its form holds them; a timed one's usual hour offered when it stops being all day. */
function formOf(e: Event): WhenForm {
  return {
    date: e.date || "",
    endDate: e.endDate || "",
    allDay: !e.start,
    start: e.start || "09:00",
    end: e.start ? e.end || "" : "10:00",
  };
}

/**
 * The Calendar App's part of an Event's Peek (ADR 0085): when it happens — its
 * guarded day and times, written through `setEventWhen` once they make an
 * Event (`eventFormErrors`), as the Event dialog does — and its notes and Tags.
 * The title, the user's own Fields and the ways through are the Peek's frame's.
 */
export function EventPeek({ doc }: PeekProps) {
  // Keyed by the Event: following a link to another one must not carry an edit over.
  return <EventPeekPart key={doc.id} doc={doc} />;
}

function EventPeekPart({ doc }: { doc: Document }) {
  const event = doc as Event;
  // Written once they make an Event; until then the half-made shape stays here, with what is wrong under it.
  const [written, writeWhen] = useSoonWritten(formOf(event), (w) => setEventWhen(event.id, whenOf(w)));
  const [unfinished, setUnfinished] = useState<WhenForm | null>(null);
  const when = unfinished ?? written;
  const errorsOf = (w: WhenForm) => eventFormErrors({ title: event.title || "untitled", ...w });
  const [notes, setNotes] = useSoonWritten(event.notes ?? "", (n) => editEvent(event.id, { notes: n }));
  const suggestions = useTagVocabulary().map((v) => v.tag);

  return (
    <div className="flex flex-col gap-4">
      <EventWhenFields
        idPrefix={ID}
        value={when}
        errors={errorsOf(when)}
        onChange={(next) => {
          const ok = Object.keys(errorsOf(next)).length === 0;
          setUnfinished(ok ? null : next);
          if (ok) writeWhen(next);
        }}
      />
      <Field label="Notes">
        <Textarea id={`${ID}notes`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={3} />
      </Field>
      <Field label="Tags">
        <TagInput
          id={`${ID}tags`}
          value={event.tags ?? []}
          onChange={(tags) => void editEvent(event.id, { tags })}
          suggestions={suggestions}
          normalize={normalizeTag}
          placeholder="Add tag…"
        />
      </Field>
    </div>
  );
}
