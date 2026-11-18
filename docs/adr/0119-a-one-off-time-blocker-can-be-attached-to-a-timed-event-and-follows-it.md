---
status: accepted
amends: ADR 0029 (the deferred option — a one-off blocker may now be attached to an Event), ADR 0085 (in part — the App draws above Core's Peek through `peekAside`)
---

# A one-off Time blocker can be attached to a timed Event and follows it

ADR 0029 left a one-off blocker tied to nothing: when the dentist moved, the travel band stayed where it was, and Push filled the hours the user was really on the road. It deferred attaching "until it gets tiresome"; it has (#497). An **attached blocker** (CONTEXT.md) is still a `time_blocker` Document of the one-off shape — not a new type, not fields on the Event. It gains two guarded Fields: `attachedTo`, a Link field to an `event` (empty = not attached), and `side`, `before` or `after` (meaningful only when attached). It is attached only on purpose, from the Event: **Before…** / **After…** on a timed Event's Peek pick a Blocker template and make a band flush against that edge of the Event. Dropping a template beside an Event never attaches; existing blockers stay plain; no migration (the Fields live in the `fields` JSON column).

**Gap and length are not stored.** The blocker keeps its absolute span as every one-off does, so paint, Push and the Schedule's drag and resize are unchanged. When the Event moves, the Calendar App reads each attached blocker's offset from the Event's *old* span and rewrites it against the *new* one: a `before` band moves as the Event's start moved, an `after` band as its end moved (`followedSpan`, moments not times, so midnight and multi-day spans work — ADR 0090). Lengthening an Event pushes only its `after` bands; an earlier start pulls only its `before` bands. A band dragged or resized by hand has, by the same rule, a new gap or length; its side never changes.

**One path for moving.** Every write that may move an existing Event in the Calendar App's data layer — the day move, the Timed reschedule, the Peek's time edit and the dialog's save — writes the Event and its attached blockers together through Core's new `putDocuments`, all or none. The Timed provider's `move` and `reschedule` already route there, so the Schedule, Month, the Hours editor and Claude's `move_item` / `reschedule_timed` follow with no change of their own; the Hours editor's Undo, which reschedules the Event back (ADR 0056), brings the bands back with it.

## Considered options

- **Store the gap and length on the blocker** — rejected: a second copy of what the span already says, out of date the moment the band is dragged; the Schedule's drag and resize would need to know about attaching.
- **Fields on the Event listing its blockers** — rejected: the Event would carry Calendar-internal bookkeeping in its Base and frontmatter, and two Documents would have to agree on one link.
- **A new Document type for attached bands** — rejected, as ADR 0029 rejected one for one-off bands: same paint, same rules, two Fields apart.
- **Attach by dropping a template next to an Event** — rejected: nothing would start following an Event by accident.

## Consequences

- `time_blocker` gains `attachedTo` and `side`; a weekly blocker never carries them, and one with a link but no valid side reads plain (`attachmentOf`).
- Core gains `putDocuments`, an all-or-none write of several Documents.
- The two Fields are hidden as well as guarded: Bases and the Vault's text never show them, since only the Calendar can tell that a link to a gone Event reads as detached. Hidden is not unlinked: `attachedTo` is a Link field and feeds the link index like any other (as the Ledger's transfer accounts and an Essay's material do), so the Event's Backlinks and the Graph list its bands, "via" the field. The band's Peek is Core's read-only one, with the App's line ("Before **Dentist**", **Detach**) above it through Core's new `peekAside` (ADR 0085: the App draws only what it owns; Core still lists the Fields), so a plain blocker's Peek is unchanged.
- The Event dialog collects Before…/After… picks while the Event is created or edited and writes them with it, in the same `putDocuments`.
- Deleting the Event deletes its attached blockers, through the blocker type's `onDelete`; the Schedule's delete offers one undo that brings them back, other deletes none (#519).
- A Workspace move takes the bands with the Event, as `followers` (ADR 0118's hook runs after the move is written) (#519).
- Making the Event all day detaches its bands, leaving them where they stand (#519).
- A link to a gone Event reads as detached, and the band is never deleted for it (#519).
- Still to come in #497: the blocker's Peek naming its Event with **Detach**, and attaching from the Event dialog (#518).
- Deferred to #496: Event templates that come with attached blockers ("Dentist" always brings travel), and Claude creating or attaching them. Claude's moves already carry them.
