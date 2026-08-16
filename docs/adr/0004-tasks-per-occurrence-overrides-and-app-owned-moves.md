# Tasks store sparse per-Occurrence overrides; Apps own move semantics through the Schedulable contract

The Tasks App keeps week-planner's asymmetric model (its ADR 0001): a one-time Task's day and completion live on the record; a recurring Task's per-day state lives in a sparse `task_occurrences` override keyed by `(taskId, sourceDate)`, existing only while an Occurrence is moved or completed (upsert-or-delete in one place, `data/repo.ts`). Occurrences themselves are derived by a pure function and never stored. Callers use unified intents (`setCompleted`, `moveItem`) and never branch on kind. Materialising occurrences as rows was rejected because it forces a generation horizon and a repair job whenever a rule changes; storing all Occurrence state on the definition was rejected because one Occurrence must move or complete without touching the others.

Moving an item on a Surface is delegated to the owning App: the Schedulable contract gained an optional `move(itemId, to)` hook, and Core's `moveSurfaceItem` calls it when present, falling back to a Placement pin otherwise. A Task therefore really changes its day when dragged on the week Surface (and its own screen agrees), while a Chore — whose due date is a computed state, not a plan — is only pinned. Making Placement the single move mechanism was rejected because the App's own screens would then disagree with the Surface, and because "unassign" has no Placement equivalent.

## Consequences

- Recurring rules are weekly-by-weekday only for now; the `Recurrence` union is the extension point (intervals/monthly can join without touching overrides).
- Recurring Occurrences are generated from the Task's `createdAt`, not for all history; a recurring Task never sits in the Unassigned pool (a null move throws, surfaces show the error).
- Surfaces need no App-specific code: pool items are those with natural date `null`; `canUnplace(appId)` tells a surface whether "back to the pool" exists for an item.
- PocketBase returns absent text fields as `""`; the Tasks data layer normalises to `null` on every read so domain checks stay strict.
