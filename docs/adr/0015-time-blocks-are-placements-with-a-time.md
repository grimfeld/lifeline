# Time blocks are Placements with a time; Apps never own clock times

The Schedule surface (day/week, hour-scaled) lets the user drag Schedulable items — Tasks, Chores, any App's work — onto hour slots to plan a day. Where the block's time lives was the decision. We extend Core's surface-owned `Placement` with optional `start`/`end` ("HH:MM"): a Placement now says "this item, on this day, at this time", exactly what the glossary already promised ("assignment to a day or time slot; subsumes the old TimeBlock"). The owning App's state is untouched — a Task still knows only its day, a Chore only its cycle — and dropping an item on a slot is the App-owned day move (when the day changes) plus a Placement with a time. Events are already timed and belong to the Calendar App, so retiming them on the surface goes through a new optional Timed hook `reschedule(itemId, date, start, end)` that Core never bypasses.

## Considered options

- App-owned times (Task.start/end, Chore.start/end…) — rejected: duplicates the same clock model in every App and forces interval-based Chores to know about hours; the surface, not the domain, is what cares about the slot.
- Blocks as their own Core entity separate from Placement — rejected: it would be a Placement with two extra fields under another name.
- Blocks on Events only (turn work into Events to schedule it) — rejected: the point is to keep the item's identity and completion in its App while giving it a slot.

## Consequences

- `placements` gains `start`/`end` (Dexie/PB migration); `useSurfaceItems` returns `start`/`end` from the pin; the Today agenda card draws blocks alongside Timed items.
- Overdue roll-forward keeps the App's day policy but drops the time — a rolled chore lands untimed on today.
- Blocks are per occurrence (`task|date`, chore cycle) and never repeat; a "default time" on a recurrence would be a later, App-owned feature.
- Completing a block completes the item through the App's `complete` hook; the block stays, drawn as done.
