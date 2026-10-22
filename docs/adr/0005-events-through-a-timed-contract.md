---
status: accepted
superseded-by: ADR 0090 (in part — "timed events are single-day")
---

# Events reach surfaces through a separate Timed contract, not Schedulable

> "Timed events are single-day" is superseded by ADR 0090: a timed Event runs from a start to an end on any day, and reaches surfaces as one piece per day carrying its whole span. The rest stands.

Events (Calendar App) are drawn on the same month/week/Today surfaces as Chores and Tasks, but they are not work: nothing completes them, they never roll forward, and they carry a time of day. Folding them into Schedulable was rejected because that contract's core hooks (`complete`, `overduePolicy`, urgency) would become optional-and-meaningless for half the implementers, and surfaces would need per-item branching. Instead Core defines a second, smaller contract, `Timed` (`useItems(range)` → items with `date`, `start`, `end`; optional `move`), and surfaces render Timed items above the day's Schedulable items with a distinct style. The month/week grids stay Core Surfaces; the Calendar App owns only Events, their screen, card and command.

## Consequences

- Events are day-bucketed with wall-clock times ("HH:MM" strings) — no timezone conversion, matching the rest of Lifeline's plain-date model. A time-slot week grid, if ever wanted, is a new Surface, not a contract change.
- Multi-day all-day events report one Timed item per day; timed events are single-day.
- Any App can put fixed-time things on surfaces by implementing `timed` in its manifest.
