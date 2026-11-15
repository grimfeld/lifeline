---
status: accepted
amends: ADR 0048 (in part — a type may run an `onMove` hook once a move is written)
---

# A type may drop what a Workspace move leaves pointing across the boundary, once the move is written

ADR 0048 makes moving the only way content crosses a separation boundary, and has what must go with a Document go in the same act: the Documents a type names as its `followers` (a Project's Tasks), and the Attachments its body embeds. Some links cannot follow. A Household's members are People chosen one by one (ADR 0117); moving the Household cannot move them, and moving one of them cannot move the Household. Left as they were, those links point into a box the reader cannot open.

So a Document type may declare **`onMove(doc, workspace)`**, a Core hook beside `onDelete`:

- **It runs once the move is written.** Every Document of the move, its followers and its Attachments are already in the new Workspace, so Documents moved together see each other there and a hook keeps them.
- **It drops, never moves.** The hook takes out what now points across the boundary (a Household's members left in the old Workspace, a moved Person's memberships of Households left behind). It does not pull more Documents along: that is `followers`, decided before the move.
- **A failing hook cannot undo or split the move.** Attachments move before any hook runs, so a Document and the Attachments it embeds never end up apart. Every moved Document's hook runs even when one throws; the first failure is then reported to the caller, whose links are left as they were for that Document.
- A type with no hook moves as before.

## Considered options

- **Run the hook before the move.** Rejected: a Household moved with some of its members would drop them, since they are not there yet.
- **Make the hook and the move one transaction.** Rejected: hooks read and write through their App's repository, which owns its own writes; the move stays the part that must succeed, and a hook's leftovers are what a later edit fixes.
- **Leave cross-boundary links in place and filter them on read.** Rejected: every reader would have to know the rule, and the link would come back if the Document moved back, as though nothing had happened in between.
