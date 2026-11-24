---
status: accepted
amends: ADR 0085 (in part — Core's Peek draws other Apps' document panels that opt in)
---

# A document panel may opt into the Peek

A Peek is the owning App's (ADR 0085): the App draws its Fields, Core draws the user's own Fields and the body, and `peekAside` (ADR 0119) lets the *owning* App draw above. No other App can add anything. A **document panel** — an App's panel beside any Document in the editor, returning nothing for the Documents it does not care about (Library's Author, Writer's Versions, Commonplace's Source) — was editor-only. Memories (ADR 0136) needs one on an Event, and an Event opens only in a Peek: it has no page and no editor.

So **a document panel may opt into the Peek.** Core draws the panels that opt in below the body in the Peek of any Document — a side panel on the desk, the bottom sheet on the phone — in the registry's App order, each returning nothing where it has nothing to say. A panel that does not opt in stays editor-only, so every existing panel is unchanged.

## Considered options

- **The Calendar draws Memories on its own Event Peek** — rejected: an App draws only what it owns, and Calendar would depend on Memories.
- **Draw every document panel in every Peek** — rejected: Versions or Source in a Peek is noise the existing panels never asked for.
- **A Peek slot only for Events** — rejected: a Contract for one type; the panel hook already says "any Document".

## Consequences

- An opted-in panel is part of every Peek it answers for, so it stays small and reads as the other App's (its colour and title), never as the owner's Fields.
- A panel that edits through a Peek obeys the Peek's rule: nothing changes until the user acts.
