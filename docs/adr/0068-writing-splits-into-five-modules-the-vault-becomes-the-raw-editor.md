---
status: accepted
supersedes: ADR 0045 (in part — "the Vault writes"), ADR 0046 (in part — the type-shaped Vault root)
---

# Writing splits into five Modules; the Vault becomes the raw editor

Every body in Lifeline was written in one place: the Vault, the Note-taking Module's Obsidian-like chrome around one `DocumentEditor`, whatever the type. ADR 0045 made that a rule ("the Vault writes, the Dashboard operates"). It held the model together, but it gave a podcast jotted on the train, an essay built from sources, a chapter of a novel and the day's journal page the same interface, and those are different acts: capture in seconds, argument from material, distraction-free invention, a codified daily ritual.

The Note-taking Module is replaced by **five Modules**, each with a writing interface of its own over its own types:

- **Journal** — Days and their Weeks, Months, Quarters and Years, with Templates and heavy markdown pages; it also homes the user-defined types the days talk about (people, places), staying agnostic about what they are.
- **Notes** — a shelf of **Sources** by kind and Tags, each holding its **Notes** and **Quotes** (ADR 0070).
- **Research** — **Essays** written from that material: robust linking, candidate material, many tabs, the graph beside the text. Essays on a topic are grouped by Tag, never by a container.
- **Manuscript** — a minimal full-screen place for creative work: a **Manuscript** of ordered **Chapters**, its outline and plan in its body, Versions per Chapter, **Outtakes** kept, a shelf of works.
- **Thoughts** — **Thoughts**: ideas, feelings, reflections with no Source and no day. A stream, not an inbox.

Connectability does not move: every one of these is still a Document in the one store, so wikilinks, Link fields, Backlinks, Tags, the Graph and Peek work across all five exactly as before. What splits is the *interface*, plus the types that genuinely differ (Note vs Thought, Essay vs Manuscript): the `writing` type retires into Essay and Manuscript/Chapter, the `daily` type becomes the Day.

The **Vault stays, demoted**: it is to bodies what a Base is to fields — the raw, bulk, plain-text editor over any Document's frontmatter and body, and where a body with no interface of its own opens. It is no Module's layout and no longer the place a body is *meant* to be written.

## Considered options

- **Keep one editor, add per-type toolbars** — rejected: the problem is the surroundings (capture sheet vs full screen vs material pane vs date strip), not the buttons.
- **Re-cut types only, keep the Vault as the writing place** — rejected: the types were mostly right already; the friction was the shared interface.
- **Retire the Vault entirely** — rejected: bulk edits, frontmatter surgery and user-defined types with bodies need a raw editor, as fields need Bases.

## Consequences

- A user-defined type may name **one Module as its home** (Person and Place in the Journal); with none it opens in the Vault or its Base.
- Every Document type has its own **Templates** (the old Notes-owned "Note template" goes).
- Existing data migrates: Notes default to Thoughts (those linking exactly one work are offered as Notes on it), Clippings become Quotes, Writings become Essays (reassignable to a Manuscript), daily notes become Days. Tested on a `pb_data` copy first.
- Five writing interfaces are five surfaces to build and maintain over one shared editor core.

## Amendment: a Journal page shows its links in the Journal sidebar

Connectability not moving was not enough while nobody could see it. Days and periods opened the editor with its links panel closed, so linking people and places from a Day meant knowing about a header toggle. Now every Day and period puts its **unlinked names** (with Link and Link all) and its **Backlinks** at the top of the Journal sidebar, above the calendar, Reviews and On this day. Period pages get that sidebar too. The editor's own panel toggle is hidden on Days and periods: it would only repeat the sidebar, and a Day's local graph adds little. On a phone, a Links button in the Phone dock opens the sidebar as a bottom sheet, with a badge counting the unlinked names. Pages of the Journal's Types keep the editor's panel, which shows their unlinked mentions, and gain **Link all** there. That Link all skips ambiguous names and locked Documents, and one undo reverts the whole batch. A period's sidebar also rolls up Reports (ADR 0076).
