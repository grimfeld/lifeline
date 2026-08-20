# Base layouts display; they never bypass App ownership

Views grow four new layouts beside table/list/cards — gallery, map, board, calendar — bringing Bases up to the Obsidian/Notion shape. The decision was what happens when a layout's natural gesture would *write*: a board drag between columns sets the group-by field, a calendar drag would move a date. Both collide with two things we already committed to — guarded fields are "never editable by a Base's raw write" (ADR 0019), and moving through time is the job of Surfaces, Placements and App-owned Moves (ADR 0004/0015). We decided: layouts never bypass ownership. A board drag on a non-guarded select is a plain field write; on a guarded field it becomes a request through a new optional App hook ("user wants engagement → IN_PROGRESS") — the owning App runs its real operation (a Shelf change also stamps dates and manages Nightstand slots) or declines, and an App with no hook leaves that board read-only. The calendar layout is read-only entirely: it exists to *see* one type by any of its date fields (Media finishedAt, Chore log doneOn) — exactly the Documents that are not Schedulable/Timed and hence never on a time Surface — not to reschedule them.

## Considered options

- Raw-write drags everywhere — rejected: silently corrupts App invariants (a Shelf set without freeing a Nightstand slot) and contradicts ADR 0019's guarded rule.
- Guarded group-by disallowed — rejected: the best boards (Media by Shelf, Chores by status) group by guarded fields; the restriction would gut the feature.
- Read-only boards everywhere — kept only as the fallback when the owning App provides no hook; drag is the point of a board.
- Calendar drag via the same hook — deferred, not needed: it would duplicate the Move/Placement machinery Surfaces own; the hook's existence makes it a pure extension if ever wanted.

## Consequences

- New optional App hook for guarded-field change requests; Media is the first implementer, other Apps fall back to read-only columns.
- Layouts needing a field (gallery image URL, map geo, board group-by select, calendar date) store the pick on the View and are offered only when the type has such a field; unplaceable Documents are omitted but counted.
- View cards on Screens render every layout faithfully — a one-type filtered map card coexists with the cross-type Map surface without redundancy.
