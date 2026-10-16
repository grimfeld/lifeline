---
status: accepted
---

# A user-defined type is deleted only when it is empty

The Journal now creates, edits and deletes its own Types — the user-defined types homed in it — beside Bases, which manages every type. Deleting a type from Bases used to be one click, unconfirmed, and left its Documents behind with a `type` no registry entry answers: no form, no Base, no Home Module, reachable only by recreating a type with the same id. Type definitions are shared across Workspaces while Documents are not (ADR 0048), so a separated Workspace showing "People · 0" could delete a type that holds two hundred people elsewhere, without seeing them.

A user-defined type can be deleted only when **no Document of that type exists in any Workspace**. While it has Documents, the delete is refused with their count — saying how many sit in other Workspaces — and a way to its Base to empty it. An empty type is deleted after one confirmation. The rule is the same from the Journal and from Bases; resetting a built-in's customisation is not a delete and is unchanged.

## Considered options

- **Cascade** (delete the type and its Documents after one confirm) — rejected: one click erases years of entries, including ones the current Workspace cannot see.
- **Orphan, with a confirm** (the old behaviour made visible) — rejected: it keeps a state no screen is built for, a Document with no type, and relies on the user knowing to recreate the same id.

## Consequences

- Counting a type's Documents must look past the Workspace read scope, the one place that does; it reports a number, never the Documents themselves.
- No Document is ever without a type by the user's hand.
- Removing a full type is two deliberate steps — empty its Base, then delete it.
