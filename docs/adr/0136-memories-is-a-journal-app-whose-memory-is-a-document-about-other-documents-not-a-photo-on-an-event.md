---
status: accepted
---

# Memories is a Journal App whose Memory is a Document about other Documents, not a photo on an Event

Nothing kept a moment worth remembering. An Event has no body (`body: "none"`, only a plain `notes` field), so a photo cannot sit on it; a Day can embed photos, but they are buried in that day's writing and tied to its date; and nothing ever brought an old moment back.

So a new hand-written App, **Memories**, joins the **Journal** Module and owns a built-in type, **Memory**: a body-first Document — words and photos, the photos being Attachments embedded by name (ADR 0037) — with a **title** the user types, a **date** of its own, and **About**, a Links field to any Linkable Document (Events, People, Places, Works…). A Memory may be about nothing: a photo and words on a date.

- **Date.** Added from an Event, it defaults to the Event's first day, and the title to the Event's title; otherwise to today. Both stay editable: a photo developed later is still that day's.
- **Where it shows.** Its own place in the Journal (a grid, newest first); a Memories document panel on an Event (its Memories, and **Add a memory** once the Event has begun) and on a Day (the Memories dated that day); a Daylog row on its date. Every other type meets Memories through its Backlinks only.
- **Remember.** Today's Day shows one Memory from a past day: one from this date in an earlier year if any, else any earlier one; the same pick all day on every device (chosen from the date, nothing stored), **Another** moving on, on that device only.
- **Capture** picks or takes an optional photo first, makes the Memory with it embedded, and opens it for words. Claude can add a Memory without photos.
- **Images only**, as Attachments are. Memories count toward no Report (Mentioned, Seen, Talked).

## Considered options

- **Photos on the Event** (a body for Events, or an image Field kind) — rejected: Event stays structured, it would serve Events alone, and a body embed is already how a Receipt keeps its photo.
- **A user-defined "Memory" type in the Journal** — rejected: it could not show on an Event, capture with a photo, or be suggested; only a built-in type carries behaviour (ADR 0019).
- **Memory as a Notes type** — rejected: Notes owns Days and the Journal's writing interface; Memories is its own thing to take, and its own Guide entry.
- **One "Of" Link** — rejected: a moment is often with two people at a place during an Event.
- **Counting Memories in Reports** — deferred: a fourth family would need its own rules; Backlinks already list them.

## Consequences

- The type is `memories_memory`, owned by the `memories` App, homed in the Journal; the Journal's hand-written sidebar gains **Memories**.
- Deleting a Memory orphans its photos, removed only by the cleanup Command (ADR 0037); deleting what it is about leaves an unresolved link, as for any link.
- The per-day pick that Commonplace's quote of the day used moves to Core, shared by both.
- Showing on an Event's Peek needs Core's Peek to draw another App's panel: the ADR "A document panel may opt into the Peek".
