---
status: accepted
supersedes: ADR 0053 (in part — the two pinned time slots)
---

# One Calendar Surface with views; the Phone bar keeps one time slot

Time was three Surfaces: the month Calendar, the Week planner (day columns and
the Unplaced pool) and the Schedule (hours, day or week — day only on a
phone). The ask was Google Calendar's mobile model: Upcoming, Day, 3 Day, Week
and Month, switched in place. Three shapes were weighed — merge into one
Surface; keep the Surfaces and give them a shared view switcher; keep them and
only add views — and the merge was taken.

The **Calendar** is now the one Surface for time, with five **views**:
**Upcoming · Day · 3 Day · Week · Month**. Day, 3 Day and Week are the
**Schedule** — the word survives as the name of the hour-scaled views, so Push,
Time block and Event template keep their wording and their rules. Month and
Upcoming are day-granular: an item on its own day only, no bands. The Unplaced
pool is a drawer offered in every view.

## Why merge rather than link

A shared switcher over separate Surfaces would have *looked* like Google and
kept every boundary, but it keeps two of everything underneath — two weeks,
two routes, two places the pool lives — and a person changing view is not
changing place. One Surface is what the user means when they say "the
calendar".

## The Week planner retires

Week is hour-scaled, as Google's is. Everything the planner did survives in
the Schedule: each day's untimed strip takes a dropped chip as "this item
takes that day", and the pool is the Calendar's drawer. Kept as a sixth view
it would have brought back the second week the merge exists to remove. The
cost is accepted: the planner's roomy day columns are narrower as strips over
a seven-day hour grid, cramped on a phone the way Google's is.

## The Phone bar: one time slot

This reverses half of ADR 0053, which pinned **Calendar and Schedule** as two
slots because "the two views of time" were two places. They are one place
now, so the bar is:

```
Calendar · [slot] · ✛ · [slot] · [slot]
```

Calendar stays fixed at the far left; capture stays fixed in the centre, at
thumb height. The freed cell is the user's, like the two on the right.
Existing Workspaces find it **empty**, never filled for them — the bar does not
guess, as 0053 already holds.

The slot still remembers nothing. The **Calendar** remembers its own last view,
per device, the way the Vault's Folder tabs keep their own; a link that names a
view opens that view.

## Consequences

- `/week` and `/schedule` stop being destinations of their own; they become
  views of the Calendar, and old links redirect to the matching view.
- The Schedule gains a 3 Day view, and Week is offered on the phone too.
- Upcoming is new: a day-granular list from the day in view onward.
- ADR 0053's rule that the time Surfaces are pinned holds for the one that is
  left; its count of two does not.
