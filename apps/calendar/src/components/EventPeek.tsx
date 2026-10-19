import { useId, useState } from "react";
import { CommitField, Field, TagInput, useCommitDraft } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary, type Document, type PeekProps } from "@lifeline/core";
import type { Event } from "../domain/types";
import { eventFormErrors, whenOf } from "../domain/eventForm";
import { editEvent, setEventWhen } from "../data/repo";
import { EventWhenFields, type WhenForm } from "./EventWhenFields";

/** Typed values are written a moment after the typing stops, as the Vault's editor writes. */
const WRITE_DELAY = 500;

/** Two forms of when are the same when every part is. */
const sameWhen = (a: WhenForm, b: WhenForm) => a.date === b.date && a.endDate === b.endDate && a.allDay === b.allDay && a.start === b.start && a.end === b.end;

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
  const written = useCommitDraft(formOf(event), (w) => setEventWhen(event.id, whenOf(w)), { delay: WRITE_DELAY, equals: sameWhen });
  const [unfinished, setUnfinished] = useState<WhenForm | null>(null);
  const when = unfinished ?? written.draft;
  const errorsOf = (w: WhenForm) => eventFormErrors({ title: event.title || "untitled", ...w });
  // Its own ids: the Peek may sit over a page with the Event dialog's.
  const idPrefix = useId();
  const suggestions = useTagVocabulary().map((v) => v.tag);

  return (
    <div className="flex flex-col gap-4">
      <EventWhenFields
        idPrefix={idPrefix}
        value={when}
        // What the store refused shows under the day, with what is wrong with the form.
        errors={{ ...(written.error ? { date: written.error } : {}), ...errorsOf(when) }}
        onChange={(next) => {
          const ok = Object.keys(errorsOf(next)).length === 0;
          setUnfinished(ok ? null : next);
          if (ok) written.change(next);
        }}
      />
      <CommitField label="Notes" multiline rows={3} delay={WRITE_DELAY} value={event.notes ?? ""} placeholder="Optional" onCommit={(notes) => editEvent(event.id, { notes })} />
      <Field label="Tags">
        <TagInput
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
