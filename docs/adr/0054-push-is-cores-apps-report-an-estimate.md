# Push is Core's; an App earns it by reporting an Estimate

A Task wants "find me time for this" in one tap. We add an optional **Estimate** (whole minutes, guessed in advance) to the Task, and a **Push** that writes a Time block of that length into the first free stretch of the Schedule's hours — or, when the item already has a block ahead, pushes that block later. Push is a **Core** operation on any Schedulable item, not a Tasks command: what it writes is a Placement, and Placements, the hours and the Timed items that fill them are all Core's already (ADR 0028). The owning App contributes only the Estimate, as a new optional Schedulable field — the Tasks App is the first to report one, and a Chore would get Push the day it does.

Push **respects Time blockers**, weekly and one-off, though ADR 0027/0029 made a band "a guide only — nothing refuses a drop". There is no contradiction: a band is a guide *to the user*, who may knowingly drop over it; a button placing work on the user's behalf is exactly who the guide is for, and ignoring it would book a Task at 3 a.m. inside sleep.

## Considered options

- **Push moves the Task's day** ("next day with room") — rejected: "time slot" means hours, hours are the Schedule's, and a Task only knows its day. A day-level push would make Tasks read Calendar hours just to change a date.
- **Tasks-only command over a Core "next free gap" query** — rejected: same behaviour, narrower reach; every later App would rebuild the create-or-push rules.
- **Always create a new block** — rejected: repeated taps pile up blocks. Push creates when nothing lies ahead and otherwise moves the earliest block ahead, at its own (possibly resized) length, strictly later.
- **Default Estimate when missing** (e.g. 30 min) — rejected: invents data the user never gave. Push asks once and keeps the answer.
- **Splitting across gaps** — rejected: one contiguous stretch or nothing; splitting stays a hand choice on the Schedule.
- **Calling it `duration`** — rejected: duration is what actually passed (a Workout Session's, a Tally's); an Estimate is a guess made before.

## Consequences

- Taken hours = timed Events + every Time block + weekly (switched on) and one-off Time blockers; all-day Events take none. Core reads them through the Timed contract and its own Placements; Tasks never learns the Calendar exists.
- A pushed block searches from its own end when it has not begun (so a tap jumps it past itself rather than creeping a quarter-hour), and from now when it has (late for it: soonest time wins). The block itself is not counted as taken.
- A new block's search starts at now, rounded up to the quarter-hour grid, or at the item's own day if that is still ahead; it runs 14 days and may land after the item's day — the day never moves (ADR 0028). Nothing free → nothing written, and the user is told.
- The prompt for a missing Estimate needs somewhere to save it, so Push is offered only where the App accepts an Estimate; done, archived and completed-Occurrence items get none.
- Undo is part of Push: remove the block it made, or put the pushed block back.
- A recurring Task's Estimate lives on the definition; Occurrences inherit it and have no override yet.
