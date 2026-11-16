import { Button, toast } from "@lifeline/ui";
import { closePeek, forgetTiming, getDocument, putDocument, type DocumentInput, type PeekProps } from "@lifeline/core";
import { Trash2 } from "lucide-react";
import type { Event } from "../domain/types";
import { deleteEvent } from "../data/repo";
import { EventForm, eventTimingKey } from "./EventForm";

/**
 * The Calendar App's part of an Event's Peek (ADR 0085): the Event Form in
 * editing mode — the same Fields the Event dialog adds with, written as they
 * change. The title, the user's own Fields and the ways through are the Peek's frame's.
 *
 * Delete acts at once and brings its own Undo, as removal from the hours did
 * (ADR 0056): the timing changed before it is no longer the Peek's to put back.
 */
export function EventPeek({ doc }: PeekProps) {
  const remove = async () => {
    const row = await getDocument(doc.id);
    forgetTiming(eventTimingKey(doc.id));
    closePeek();
    await deleteEvent(doc.id);
    if (!row) return;
    toast.success(`${doc.title} deleted`, {
      action: { label: "Undo", onClick: () => void putDocument(row as DocumentInput).catch((e: Error) => toast.error(`Could not bring it back: ${e.message}`)) },
    });
  };
  return (
    <div className="grid gap-4">
      <EventForm mode="editing" event={doc as Event} />
      <Button variant="destructive" size="sm" className="justify-self-start" onClick={() => void remove().catch((e: Error) => toast.error(`Could not delete it: ${e.message}`))}>
        <Trash2 /> Delete event
      </Button>
    </div>
  );
}
