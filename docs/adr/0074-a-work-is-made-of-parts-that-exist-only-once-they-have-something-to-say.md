---
status: accepted
amends: ADR 0024 (in part — the Library gains manga), ADR 0035 (in part — Marks and the Review are no longer Cinema's and the Discotheque's alone)
---

# A work is made of Parts that exist only once they have something to say

> Amends ADR 0024 (the Library gains manga as a third type) and ADR 0035 (Marks
> and the Review are no longer Cinema's and the Discotheque's alone).

A comic, a manga, a series, an album and a book are each read (watched, heard)
piece by piece, but a work was one Document with one Shelf and a bare `size`.
There was no way to say how far into One Piece I am, nor to review an issue or a
season — and season reviews are the common case, not the rare one.

## Decision

- A work may be made of **Parts** (issues, chapters, episodes, tracks), optionally
  collected into one level of **Groups** (volumes, seasons, discs, sections). Both
  are Documents owned by the work's family App and carry a read day, Marks and a
  Review. Films and games never have Parts; a work whose Parts are not tracked is
  unchanged.
- **A Part or Group exists only once it has something to say** — a read day, a
  Mark, a Review, or (a Group) a declared size or first Part. The rest of the run
  is the numbers the work's size describes.
- **Caught up to** is one stored read-through position on the work, read with no
  day, so a work added mid-run is one act and never a thousand ticks.
- Whether Part numbers restart in each Group is fixed per medium: series and
  albums restart, manga, comics and books run on.
- Progress is derived; Done is offered on the last known Part, never set; Marks
  never roll up.
- **Manga** is a Library type of its own (Nightstand cap 3), a comic in every
  other respect. Library works get Marks and a Review like Cinema's.

## Considered options

- **Every Part a Document, created up front** (from the provider or a count).
  Rejected: One Piece alone is ~1,150 empty Documents to sync, index and show in
  the Vault, and the provider lists are uneven.
- **A single "read up to" bookmark and no Part Documents.** Rejected: nowhere to
  put a Review, and no day for each read.
- The chosen shape keeps the bookmark only for the past I never logged, and
  Documents only where there is something to say. The cost is that "is Part 12
  read?" is answered from two places — the read-through position and Part 12's
  own read day.
- **Group as a plain field on the Part.** Rejected once season reviews were
  wanted: a field cannot carry a Review.

## Consequences

- The Parts logic, its data actions and its controls live in a shared package,
  `@lifeline/parts`, because three Apps need the same behaviour and no App
  imports another. The package owns no types: each App registers its own
  `<app>_part` and `<app>_group` types through `createPartsKit` and keeps its
  own Shelf, which the kit calls back to for Start and Done.
- A book's `size` is pages, so its run is counted in a field of its own
  (`partCount`). Every other medium counts its run in `size`.
- A Part or Group opens as a dialog over the work's detail, which is itself a
  dialog. Neither is a routed screen.
- "+1" appears only on works whose Parts are tracked, so a tap on a Card never
  starts tracking by itself.
