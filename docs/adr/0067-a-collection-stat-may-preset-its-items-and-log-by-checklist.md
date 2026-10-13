---
status: accepted
---

# A Collection Stat may preset its items and log by checklist

> Builds on ADR 0007: Entries stay the only truth and Collection items still
> dedupe by trimmed, case-folded name at derivation.

Some collections are known up front: the countries of a region, a trail's
huts, a set of books. Typing each name when it is collected invites typos that
count as new items, and nothing shows what is left. The free-text field also
offered a browser `<datalist>` of past items, which rendered unstyled (no
background) on some browsers; it is gone, the field is plain text.

## Decision

A Collection Stat may hold an ordered **item list** (`items`, a list Field,
trimmed and deduped by normalised name on save). While the list is non-empty:

- **The list is the denominator.** Its length replaces the typed universe size,
  which the editor hides (and keeps, for when the list is emptied).
- **Logging is a checklist.** The log dialog lists the items in order, ticked
  when an Entry for the item exists. Ticking adds an Entry at the dialog's
  "When"; **unticking deletes every Entry of that item** (duplicates included)
  and leaves the item on the list.
- **Items collected that are not on the list** (logged before it existed, or
  through the `stats.log` Command under another name) show after the list,
  ticked, so they can be unticked. They still count.
- The detail page shows what is still to collect. The `stats.log` Command logs a
  listed item under the list's spelling.

No list means free-text logging, as before.

## Consequences

- Unticking is the one place a Stat's Entries are deleted by item rather than by
  id; it is a correction, not a log, and the item's history goes with it.
- Renaming an item on the list does not rename its Entries: the old name shows
  as "not on the list" until it is unticked or the spelling matches again.
