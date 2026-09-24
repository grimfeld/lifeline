# Timed items are removed through their App, which owns the Undo

On a phone the Schedule's hours are edited through a sheet opened by tapping the thing on them — a Time block, an Event or a one-off Time blocker — and that sheet must be able to remove it. A Time block is Core's (a Placement), so removing one is Core's business. An Event or a one-off blocker is the Calendar App's, and the Timed contract has so far only let Core read, move, retime and create them. We add optional **`remove`**, **`rename`** and **`href`** to the Timed contract. `remove` returns an **`undo()`**: the owning App restores what it deleted — whole, notes and Tags included — and Core only calls it. This is the contract's first destructive operation, and it mirrors Push's outcome shape (ADR 0054).

Sheet edits save live and are never confirmed. One Undo per sheet session puts back whatever the item was when the sheet opened. A removal is undone the same way. There is no "are you sure" anywhere on the Schedule.

## Considered options

- **Core recreates the item through `create`** — rejected: `create` knows title, day and times, so notes, Tags and the id would be lost. Making it lossless would teach Core every Event field.
- **No removal from the Schedule, "Open in Calendar" only** — rejected: removal is one of the three things the phone Schedule could not do, and a hop to another App for it is the problem rather than a fix.
- **Confirm dialogs instead of Undo** — rejected: a confirm on every removal makes the Schedule slow to edit, and live edits have no single moment to confirm.

## Consequences

- An App that offers `remove` without a working `undo` has broken the contract. A Timed provider without `remove` shows no delete in the sheet.
- Only the newest Undo is live, as with Push: an older one would restore a state that has already moved on.
- Weekly Time blockers get no `remove` from the Schedule, because a rule is edited where rules live.
