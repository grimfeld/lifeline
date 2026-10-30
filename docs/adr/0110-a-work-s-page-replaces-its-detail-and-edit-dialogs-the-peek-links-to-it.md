---
status: accepted
amends: ADR 0085 (the Peek edits — a work's Peek now leads to its page)
---

# A work's page replaces its detail and edit dialogs; the Peek links to it

A book, comic or manga was seen in three places: its Peek, a detail dialog opened from the Gallery, and a separate edit dialog for the Fields the detail could not change. Each showed part of the work, the edit dialog saved a whole form at once while the Peek edited in place (ADR 0085), and none had room for what a work gathers: its Parts, its Review, its series, what mentions it. Authors already had a page of their own (ADR 0052).

So **every work of the Library has a page**, a hidden route beside the Author's (`/app/library/works/:id`):

- **It shows the whole work.** Cover and byline, where it stands, every plain Field edited in place as its Peek edits them (ADR 0085), its Parts and Groups (ADR 0074), the Marks and the Review, its history (added, acquired, slotted, started, finished), the other works of its series on the shelf in series order, and the Documents that mention it. Guarded Fields (Shelf, Acquisition, slot, the stamped days) move only through the Library's transitions (ADR 0019): the Shelf menu, the Acquisition select, Slot it.
- **The frame is the Parts kit's.** `WorkPage` in `@lifeline/parts` draws the header, the Title field, the Review, the history and the backlinks; the App hands in its cover, byline, status, actions, Fields, Parts and its own sections (the Library's series list). Cinema, Discotheque and Arcade adopt it in their own changes.
- **The detail dialog is gone and the add dialog only adds.** A Gallery tile opens the page; a row on the Nightstand tab or an Author's page links to it by its title.
- **Links and chips elsewhere still peek** (ADR 0057): a Card, a wikilink, a backlink opens the work's Peek where the user is. The work type's `href` is now its page, so the Peek's own "Open" leads there, and opening a work from inside the Culture Module goes straight to it.

## Considered options

- **Keep the detail dialog and drop only the edit dialog.** Rejected: a dialog has no room for Parts, series and backlinks on a phone, and it cannot be linked to.
- **A page per App, each drawn from scratch.** Rejected: the four family Apps' detail dialogs were already near copies (`WorkDetailDialog` in each); a shared frame keeps them alike and leaves each only its own pieces.
- **An "Open" link drawn inside the work's Peek.** Rejected: the Peek's frame already has one, led by the type's `href`; a second would say the same thing twice.

## Consequences

- `/app/library/works/:id` is a hidden screen with a `SCREENS` row; the Guide places it on the Culture page through its Module.
- `EditWorkDialog`, `WorkDetailDialog` and the actions menu's "Edit" are removed from the Library. The Library's Cards peek a work instead of opening the edit dialog.
- Cinema and Discotheque keep their dialogs until they adopt `WorkPage` (#383, #384). The Arcade has adopted it (#385): its page (`/app/arcade/works/:id`) shows no Parts, Marks or Review, because games keep none, so `WorkPage` takes `review={false}`.
