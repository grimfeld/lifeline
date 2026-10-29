---
status: accepted
amends: ADR 0024 (in part — works are not editions, so an ISBN is a way to find a work, not a field of one)
---

# An ISBN finds a work and is never stored

The most precise thing printed on a book is its ISBN, but it names an edition and a **work** is not an edition (ADR 0024). A lookup box therefore accepts an ISBN as a key that leads to the work, and forgets it.

- **Detection.** A query is an ISBN when it is nothing but 10 or 13 digits (hyphens and spaces ignored; an ISBN-10 may end in X) with a valid checksum. A number that fails its checksum is searched as plain text, so a typo never lands on the wrong book.
- **Resolution.** For books, comics and manga alike, Open Library's ISBN lookup answers first (edition, then its work), then Google Books' `isbn:` search. Comic Vine does not take ISBNs.
- **The hit is the work.** It carries the work's external key, never the edition's; cover, year, size and authors map as for any other hit.
- **Never stored.** The Work has no ISBN field, and nothing records which edition was held.
- **One page.** An ISBN answers with the one work; "More" has nothing further.

## Considered options

**An ISBN field on the Work.** Rejected: it makes an edition of a work, the split ADR 0024 refused, and two copies of one work would want two ISBNs.

**Detecting an ISBN without a checksum.** Rejected: any 10 or 13 digit number (a year range, a phone number) would be sent to the ISBN lookup instead of the text search.

## Consequences

- The Add dialog, Find metadata and any other lookup box gain ISBN search with no new field.
- Matching a work already on the shelf stays by external key (ADR 0052's twin rule), so the same book found by two ISBNs is one work.
