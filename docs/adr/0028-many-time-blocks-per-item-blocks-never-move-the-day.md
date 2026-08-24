# An item may have many Time blocks; a block never moves the item's day

A long Task wants to be planned as several stretches — Monday 9–11, Wednesday 14–16 — and stay in the pool, greyed, ready for a third. Until now a Placement was unique per item (`[appId+itemId]`), dropping a chip on the Schedule first *moved* the Task to that day and then pinned the time, and a pin on any other day than the Task's own was ignored as stale (ADR 0015). We drop the uniqueness: an item may own any number of Placements, on any days, and a Time block is a copy made from a chip — the chip (in the pool or in a day's strip) stays where it is, greyed while a block lies ahead. Placing a block never calls the App's `move`; the Task's own day is the plan day the week planner and the Tasks screen show, and only a day-granular drop (or a drop into a day's *untimed strip*) changes it. A block has no done state: its tick is the item's tick, and completing the item drops every block that starts after that moment and keeps the past ones as record.

## Considered options

- **Task day derived from its blocks** ("due = first open block") — rejected: the Tasks App would have to watch Core's Placements, inverting App-owns-day (ADR 0004); a Task with no blocks would have no day to derive.
- **Per-block done flag on the Placement** — rejected: Core would own a completion-ish state the App cannot see; Today and the Tasks screen would disagree about "done".
- **A new "Session" entity for a Task's stretches** — rejected: it is a Placement with a time under another name (the ADR 0015 argument again).
- **The pool as a full work list** (every open Task, dated or not, greyed when blocked) — rejected: the same Task would sit in the list and in its day's strip at once; pool membership stays "no day yet".

## Consequences

- `placements` loses the unique `[appId+itemId]` index (kept as a plain lookup); `placeItem` always inserts, `moveItem` targets a Placement id. `useSurfaceItems` yields one row per block, plus the item on its own day for day-granular views.
- Hour-scaled views and the Today feed show every block on its day; the week planner and month grid show the item on its own day only — three chips for one Task would read as three Tasks, and dragging one would be ambiguous.
- A block dragged into the pool is deleted, the item untouched; into a day's strip, deleted and the item moved to that day (the one place a block drag still reaches the App); onto another slot, moved alone.
- Chores keep their day-only Placement pin as the Core fallback for Apps that own no moves; nothing changes for them except that they, too, may carry several timed blocks.
- Deleting an item leaves its Placements as invisible orphans (as before); Core sweeps Placements whose item no longer reports.
- Blocks never roll forward: a passed block of an open item stays where it was, drawn muted, as record. The item's own row still rolls per the App's policy (ADR 0015), which is where a missed Chore shows up on today.
