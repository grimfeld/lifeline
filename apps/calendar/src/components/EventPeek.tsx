import { useRef } from "react";
import { Button, toast, toastWithUndo } from "@lifeline/ui";
import { closePeek, forgetTiming, removeTimedItem, type PeekProps } from "@lifeline/core";
import { Trash2 } from "lucide-react";
import type { Event } from "../domain/types";
import { APP_ID } from "../timed";
import { EventForm, eventTimingKey } from "./EventForm";

/**
 * The Calendar App's part of an Event's Peek (ADR 0085): the Event Form in
 * editing mode — the same Fields the Event dialog adds with, written as they
 * change. The title, the user's own Fields and the ways through are the Peek's frame's.
 *
 * Delete acts at once and brings its own Undo, as removal from the hours did
 * (ADR 0056): what the Form still holds is written first, so the Undo brings back
 * the Event as it was left, and the App's Timed `remove` does the deleting.
 */
export function EventPeek({ doc }: PeekProps) {
  const flush = useRef<(() => Promise<void>) | null>(null);
  const remove = async () => {
    await flush.current?.();
    const undo = await removeTimedItem({ appId: APP_ID, itemId: doc.id });
    forgetTiming(eventTimingKey(doc.id));
    closePeek();
    toastWithUndo(`${doc.title} deleted`, undo);
  };
  return (
    <div className="grid gap-4">
      <EventForm mode="editing" event={doc as Event} flushRef={flush} />
      <Button variant="destructive" size="sm" className="justify-self-start" onClick={() => void remove().catch((e: Error) => toast.error(`Could not delete it: ${e.message}`))}>
        <Trash2 /> Delete event
      </Button>
    </div>
  );
}
