---
status: accepted
superseded-by: ADR 0059 (in part — the per-App Tally)
---

# Loggable: cross-App logging goes through a Core Contract, never App-to-App

A Workout Session should count as a Habit Completion (Life Level) or a Stat Entry (Stats). No App imports another (CONTEXT.md: Apps interoperate only through Contracts defined by the Core), and the owning App must stay the one that writes its Documents. So Core gains a third behavioural Contract after Schedulable and Timed: **Loggable** — an App entity that accepts a logged occurrence from anywhere. A provider lists its targets (`useTargets()`: key, title, what value it wants — none, a count, a duration, a number) and does the write (`log(targetId, { at, value?, note? })`). A Workout carries **Tallies** — target + what to send (one, the duration, a Block's result) — and saving a Session logs each through Core, once.

## Considered options

- **Direct import** (`Workout → completeHabit`) — rejected: breaks the only-through-Contracts rule; every new bridge would be a new coupling.
- **Session links only** (a Link field to the Habit, log by hand) — rejected: the bridge isn't a bridge.
- **The receiving App watches Sessions** — rejected: Life Level would have to know Workout exists; inverts ownership.

## Consequences

- Stats implements Loggable for Stats (Entry: value at a moment; Boolean Stats take "one"), Life Level for Habits (Completion at a moment). Negative activities are not targets.
- A Tally fires on Session save and is recorded on the Session (`tallied`), so editing or re-saving never double-logs; deleting the Session does not un-log (the Entry/Completion is the receiver's Document, with its own delete).
- Any App may offer targets or send to them: Chores or Tasks feeding a Habit needs only a Tally-like field on their side.

> The sending side (the per-App Tally) is superseded by ADR 0059: Tallying is a Core Contract.
