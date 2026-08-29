# A missed Occurrence lapses when the next one arrives: a recurring Task is overdue at most once

Tasks keep the "stay" overdue policy (ADR 0004): a missed Task does not roll forward, it stays on its day and reads as overdue. For a recurring Task that read multiplied — a daily Task missed for a fortnight was fourteen overdue rows on the week Surface, in the Today tasks Card and in the "Complete a task" Command, every one of them the same work, and the pile only grew. The decision is that **an Occurrence lapses the moment its rule produces a newer one**. Only the Occurrence a Task is currently on — the latest source day its rule has produced on or before today — can read as overdue; every earlier open Occurrence is **lapsed**: it keeps its day as record but carries no urgency and is never gathered into an Overdue list. The overdue standing therefore resets on the recurrence's own beat, and needs no stored state: `deriveItems` takes `today` and marks each item, finding the current source day by walking back one week, one month or one year, whichever the rule needs. Completion is untouched — a lapsed Occurrence can still be ticked on its own day, and ticking one never un-lapses another. On the Core side the week Surface's Overdue drawer now asks the owning App (the item's `urgency`) instead of gathering everything with a past day, which is what let lapsed Occurrences — and any other App's merely-earlier items — accumulate there.

## Considered options

- **Collapsing the misses into one "overdue since" row, as a Chore does** — rejected: a Chore computes a single due date and has no per-day identity, while a Task's Occurrences each complete and move on their own (ADR 0004). A collapsed row would have no day to tick, and the per-Occurrence overrides would have nothing to key on.
- **Dropping lapsed Occurrences from the derivation entirely** — rejected: the week and month Surfaces are also a record of what happened; a Monday that was missed should still show, on Monday, that it was missed. Lapsing changes the urgency, not the history.
- **Rolling the missed Occurrence forward onto today (the Chores policy)** — rejected: it rewrites the past on a planning Surface, and a recurring Task would land twice on today — the rolled miss and today's own Occurrence.
- **Writing a `lapsed` flag onto the Occurrence override when the next one arrives** — rejected for ADR 0004's own reason: it materialises state the rule already implies, and it would need a sweep job to keep true as days pass.
- **Shortening the Surfaces' lookback windows instead** — rejected: it is a coincidence, not a rule. A short window still multiplies a daily Task inside it, and hides a genuinely overdue yearly Occurrence outside it.

## Consequences

- `TaskItem` gains `lapsed`, and `deriveItems(tasks, overrides, range, today)` takes the day to judge against (defaulting to `todayStr()`) so the derivation stays pure and testable.
- The Tasks Schedulable provider gives a lapsed Occurrence `urgency: "none"`: Surfaces stop painting it as overdue, and it drops out of the week's Overdue drawer, the Today tasks Card, the "Complete a task" Command and the Tasks screen's badges.
- The week Surface's Overdue drawer filters on `urgency === "overdue"`, so a "stay"-policy App's past-but-not-overdue items (and everything before the week when browsing a future week) no longer land there.
- One-time Tasks are unchanged: nothing supersedes them, so an overdue one stays overdue until it is done or moved.
- An Occurrence moved onto today or a later day is never lapsed — a deliberate move outranks the rule.
- Occurrence overrides, the Daylog and the "Completed recently" list are untouched: what was actually done is unaffected.
