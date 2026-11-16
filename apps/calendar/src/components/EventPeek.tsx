import type { PeekProps } from "@lifeline/core";
import type { Event } from "../domain/types";
import { EventForm } from "./EventForm";

/**
 * The Calendar App's part of an Event's Peek (ADR 0085): the Event Form in
 * editing mode — the same Fields the Event dialog adds with, written as they
 * change. The title, the user's own Fields and the ways through are the Peek's frame's.
 */
export function EventPeek({ doc }: PeekProps) {
  return <EventForm mode="editing" event={doc as Event} />;
}
