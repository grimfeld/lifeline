# Workout App: Workouts are Blocks of intervals, Sessions record, PRs derive

A workout timer that knows EMOM, AMRAP, Tabata and For Time could have been a single-mode tool with no memory. It is instead an App in the house shape — Document types plus behaviour. A **Workout** is an ordered list of **Blocks**, each in a mode with that mode's few parameters and its **Movements**; every mode is only a way of writing work/rest intervals, and the timer plays the expanded sequence without knowing which mode wrote it. Running a Workout makes a **Session** — when it ran, each Block's result in the mode's terms, what each Movement actually got — which is a Timed item and a Daylog fact. **Exercises** are a hand-curated library (name, category, equipment, *measure*) and a Movement must point at one: that link is what lets **PRs** be derived from Sessions — best of the Exercise's measure, plus a rep table for loads — never stored or declared. Workouts are not Schedulable: planning is an Event or a Task, the Session appears when it happens.

## Considered options

- **One mode per Workout** — rejected: a real session is warm-up → main → cooldown; three Workouts run back to back would be three Sessions for one training.
- **Free-text movements with an optional Exercise link** — rejected: PRs exist only for linked ones and the library drifts into near-duplicates; "create Exercise…" in the editor makes the required link cheap.
- **Declared PRs ("that was a PR")** — rejected: nothing checks them and history can't recompute; derived PRs follow the Stats rule (totals from Entries, never stored).
- **Workouts as Schedulable** — rejected: a Workout would carry a day *and* be a template, the pool would fill with every saved Workout, and a "planned but not run" state would need inventing.
- **A seeded Exercise list** — rejected: the user curates; a seed becomes clutter to delete.

## Consequences

- Types: `workout`, `exercise`, `workout_session`. Blocks and Movements are structured fields *inside* the Workout (a Block is not a Document — it has no life outside its Workout); Session results mirror that structure. All three are guarded where the App owns the meaning (blocks, results).
- The timer is drift-free by construction: it derives the current interval from `startedAt` and the expanded sequence, never from accumulated ticks, so a backgrounded tab resumes correctly.
- Deleting a Workout keeps its Sessions (they are what happened); deleting an Exercise is refused while any Workout or Session uses it.
- PR derivation scans every Session's Movement results for the Exercise; fine at personal scale, a derived index if it ever isn't.
