---
status: accepted
amended-by: ADR 0074 (in part — Marks and the Review are no longer Cinema's and the Discotheque's alone)
---

# Cinema and Discotheque take Letterboxd's marks: one Shelf and one Review per work, no diary; Playlists own their membership

The Cinema and the Discotheque (ADR 0024) tracked only where a work stood — the four-state Shelf and its stamped days. In use the missing half was Letterboxd's: say in one click that a film was watched, that I liked it, how many stars, a few words about it, and gather works into hand-made lists. The decision is to add exactly that surface on the existing model rather than adopt Letterboxd's. **Done is one click from any shelf** (a film needs no "in progress"; a series keeps it), and a second click undoes it. **Marks** — `liked` and a whole-star `rating` (unrated is its own state, not zero) — are plain fields on the work: independent of each other, of the Shelf, and of any date; a Shelf move never touches them. The **Review is the work's Document body**, not a field: one per work, and it gets text mode, wikilinks, `#tags` and Backlinks for free. There is **no diary**: `finishedOn` is the last watch, and a rewatch overwrites it. A **Playlist** is its own Document type per App (`cinema_playlist`, `discotheque_playlist`) holding an ordered, guarded list of work ids, an optional blurb (its body) and a `ranked` flag; **membership belongs to the Playlist**, never to the work, and a work in any number of them. Library and Arcade are untouched: the Library has its own instruments for this (Nightstand, Shopping list) and the marks do not fit games.

## Considered options

- **A watch diary (one Document per viewing: day, rating, review, rewatch flag), Shelf and `finishedOn` derived from it** — rejected for now: it is Letterboxd's real model and the only way to keep every viewing's date, but it moves the Cinema to a derived-state design (repo, daylog, every card) for a feature the user has not asked for. Adding it later is additive — existing `finishedOn` days seed the first entry — so the flat work stays the fact for now.
- **Half-stars (½–5, stored as 1–10)** — rejected by the user: whole stars are enough; unrated ≠ 0 is the distinction that matters.
- **Liking marks a work Done** — rejected: one click does one thing; Done has its own click. A liked-but-unwatched film is legal and merely odd.
- **Review as a `review` longtext field, body kept at `none`** — rejected: the body already *is* "my words about the thing" (the Museum's commentary, a Note), and a field would forgo wikilinks, Backlinks and text mode. The cost is that every movie is now eligible to open as text, mostly empty.
- **Lists as Tags (`list/best-scifi`) or as Base Views** — rejected: a Tag has no order and no blurb, a View selects by filter; a Playlist is chosen and ordered by hand. The Museum's Exhibition (membership as ordered ids on the curating Document, up/down reorder) is the precedent followed.
- **One cross-family `playlist` type mixing films, albums, books** — rejected: ADR 0024 gives every Document one owning App; a mixed list has none. Two types, two copies, as the split intends.
- **Marks as Daylog lines ("Rated ★4", "Liked")** — rejected: a mark is a fact about the work, not an event; changed twice it would be two lines with one truth. The Daylog keeps only Watched / Listened.
- **Applying the same to Library and Arcade in the same change** — rejected by the user: the Library already has its attention instruments; ratings and playlists do not suit games.

## Consequences

- `movie`, `series` and `music` gain `liked` (boolean) and `rating` (number, 0 = unrated), both plain — editable in Bases, no invariant worth guarding — and `body: "optional"`. Old rows read as unliked, unrated, no review; no migration.
- `finish()` from UNSTARTED leaves `startedOn` empty; undoing Done returns a series to Watching when it had started, else to the To… shelf, and clears `finishedOn` only.
- Deleting a work removes it from every Playlist of its App (the Museum's cascade, copied).
- Two new capture commands ("Mark watched…", "Mark listened…") put the one-click plus stars and heart on the phone sheet.
- If a diary ever comes, `rating`/`liked` stay on the work (Letterboxd's own choice — the film is rated, the viewings are logged), and only `finishedOn` moves to being derived.
