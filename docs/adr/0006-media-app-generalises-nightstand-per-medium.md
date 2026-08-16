# The Media App generalises Nightstand to any medium, with a per-medium slot cap fixed in code

readlist/Nightstand tracked books on two independent axes (Acquisition × Engagement) with five held Slots as an attention budget. Lifeline's Media App keeps that model verbatim and makes the medium a field: a compile-time `MEDIA_TYPES` registry (book, comic, movie, series, music, game) supplies the labels that actually differ per medium — creator wording, size unit, Engagement verbs, cover shape, lookup source and slot cap — while the axes, Studied, Reason, Backlog, the auto-stamped days and every transition are shared. Adding a medium is adding a registry entry.

Each medium has its own Nightstand and cap (books 5, comics/movies/series/albums 3, games 2). One shared cap across all media was rejected because it would either be too tight for books or meaningless for the rest; a user-editable cap was rejected for the reason Nightstand's ADR 0001 gave — a limit that can be raised in two taps is not a forcing function. Per-medium progress fields (episodes, playtime, issues) were rejected: slot age (days since started/slotted, stale at 60) stays the anti-stall signal.

## Consequences

- Engagement is stored medium-neutral (`UNSTARTED / IN_PROGRESS / DONE / ABANDONED`); only display verbs vary.
- External identity is a namespaced `externalKey` (`openlibrary:/works/…`); Open Library lookup exists for books and comics, everything else is manual entry until another source is wired in.
- Unlike readlist, the client is offline-capable via Core sync; the "two devices claim the last slot" race resolves by LWW and is accepted for one user.
- The Media App does not implement Schedulable or Timed: media are not work on days.
