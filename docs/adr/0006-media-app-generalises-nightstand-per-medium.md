---
status: superseded
superseded-by: ADR 0024
---

# The Media App generalises Nightstand to any medium, with a per-medium slot cap fixed in code

readlist/Nightstand tracked books on two independent axes (Acquisition × Engagement) with five held Slots as an attention budget. Lifeline's Media App keeps that model verbatim and makes the medium a field: a compile-time `MEDIA_TYPES` registry (book, comic, movie, series, music, game) supplies the labels that actually differ per medium — creator wording, size unit, Engagement verbs, cover shape, lookup source and slot cap — while the axes, Studied, Reason, Backlog, the auto-stamped days and every transition are shared. Adding a medium is adding a registry entry.

Each medium has its own Nightstand and cap (books 5, comics/movies/series/albums 3, games 2). One shared cap across all media was rejected because it would either be too tight for books or meaningless for the rest; a user-editable cap was rejected for the reason Nightstand's ADR 0001 gave — a limit that can be raised in two taps is not a forcing function. Per-medium progress fields (episodes, playtime, issues) were rejected: slot age (days since started/slotted, stale at 60) stays the anti-stall signal.

## Consequences

- Engagement is stored medium-neutral (`UNSTARTED / IN_PROGRESS / DONE / ABANDONED`); only display verbs vary.
- External identity is a namespaced `externalKey` (`openlibrary:/works/…`); Open Library lookup exists for books and comics, everything else is manual entry until another source is wired in.
- Unlike readlist, the client is offline-capable via Core sync; the "two devices claim the last slot" race resolves by LWW and is accepted for one user.
- The Media App does not implement Schedulable or Timed: media are not work on days.

## Amendment (Aug 2026): one shelf, Nightstand for books and comics only

In use, the two-axis model and the Backlog/Gallery/Nightstand tabs were more than the medium warranted: the Backlog and the Gallery were the same set with different chrome, and slots made sense for reading but not for movies, music or games. The App now has **one primary Shelf per item — the Engagement axis under its verbs: To read/watch/listen/play · In progress · Done · Dropped** — shown as a single Gallery with shelf and medium filters. Acquisition is kept as data (importer, Shopping-list card) but demoted to an optional "owned" detail, never asked on add. The Nightstand survives only where slots earn their keep — books (5) and comics (3); other media have no slots (`slotCount: 0`). Adding is one line (title, optional creator, medium) straight onto the To… shelf, with optional lookups (Open Library for books/comics, MusicBrainz for music); the detailed dialog remains for the rare case.

## Amendment (Aug 2026): metadata lookups per medium

Quick add and "Find metadata" use free sources per medium — Open Library (+ Google Books fallback) for books/comics, TMDB for movies/series, MusicBrainz for albums, RAWG for games, ComicVine optionally for comics. Where a provider needs a personal API key, the key lives in a synced `media_settings` record (the user's own PocketBase — the trade-off ADR 0017 already accepted); providers that refuse browser calls go through Core's `fetchExternal`. A lookup fills *empty* fields only (creator, year, cover, size, external key) and never overwrites the user's edits; "Refresh from source" re-pulls cover/size for an item that has an external key; "Enrich all" walks keyless items and only auto-applies an exact title+year match. No new item fields: synopsis, genres and ratings are out of scope.
