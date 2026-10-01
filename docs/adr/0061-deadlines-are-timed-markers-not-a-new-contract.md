# Deadlines are Timed markers, not a new Contract

A Project's or Milestone's **Deadline** should stand on the time Surfaces (the month Calendar, the Week planner, the Schedule's all-day strip), so a promise made inside the Projects Module is visible where the user plans. Nothing *happens* on a Deadline, so it is neither Timed in the glossary's original sense nor Schedulable. We nonetheless report it through the **Timed** Contract as an all-day item with a `marker` flag, which Surfaces draw as a flag rather than an Event chip.

Timed already carries all-day items, multi-day items, read-only items (Calendar subscriptions), Tag filtering, Module scope and the drag-to-another-day hook. A marker that is all day takes no hours, so Push plans straight through it. Dragging one changes the Deadline through the Projects App, undoably. A missed marker stays on its day, red, and never rolls forward. It vanishes once its Project is Done or Dropped, or its Milestone is reached.

## Considered options

- **A new Core "Deadline" Contract.** This is cleaner in meaning, but every Surface would need a second read path for a single implementer. Revisit it if a second, non-Project kind of marker appears (a passport's expiry, say) and Timed starts bending.
- **Deadlines inside the Projects Module only.** Rejected by the user: a promise the planning views never show is easy to miss.
