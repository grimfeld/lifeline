# The Bible App is a lens: it owns the references and scopes the material

Bible study wanted "its own graph, references, clippings and writings". Rather than a walled notebook with its own note, clipping and writing types (three editors re-implemented, "a Note is my thinking about things" split by subject, Journal/Graph integrations redone), the Bible App owns only what did not exist — the **references**: **Verse** (one per single verse, `John 3:16`), **Chapter** (`John 3`), **Book** (`John`; type ids `verse` / `bible_chapter` / `bible_book`, since the Library owns `book`), **Character** and **Concept**, all Linkable, all with bodies, none seeded — a Verse and its Chapter and Book are created the first time they are written. The study material stays what it is: Notes, Clippings and Writings (a **Talk** is a Writing in a "Talks" project) that wikilink those references, wherever they live. The App is a lens over them: it lists what links to its references, draws the Graph scoped to its types plus their neighbours, and reads verse references in any body.

A range written once — `[[John 3:16–18]]` — must count as a link to each Verse. Core resolves one wikilink to one target and knows nothing of scripture, so the Linkable contract gains one generic hook: a type may supply an **expander** (`expand(name) → titles | null`), and the link index resolves an expanded name to every title returned. Bare references in prose ("see Rom 8:28") are found by the App and *offered* as links in a panel, never linked silently.

## Considered options

- **Separate types** (`bible_note`, `bible_clipping`, `talk`) — rejected: see above.
- **One Verse per reference as written** (`John 3:16–18` as its own Document, overlap derived) — rejected by the user: the passage would be a node the single verse isn't part of; per-verse hubs with ranges expanding to each keep one identity per verse.
- **Stored verse text** (fetched via `fetchExternal` or pasted) — rejected: a Verse is a hub Notes connect through; the Bible stays on the shelf.
- **Implicit links from bare references** (the App's scanner feeding the link index) — rejected: prose like "John 3" misfires, and a link you cannot see in the text you cannot remove.
- **Seeding the canon** (66 Books, 1,189 Chapters) — rejected: an untouched canon is clutter; the graph shows what the study touched.
- **A Bible-owned `talk` type** — rejected: Versions are the Writer's internal type keyed to `writing`; a Talk would need its own snapshot machinery.

## Consequences

- Core: `DocumentTypeDef.linkable.expand`; `buildLinkIndex` resolves through it before the title lookup, one wikilink → several ResolvedLinks. `GraphOptions.focusTypes` keeps those types and their neighbours. `AppManifest.useBackground` — a hook the shell runs once for every App — lets the Bible App materialise references from unresolved names.
- Cross-chapter ranges (`John 3:16–4:2`) resolve to the Chapters they span, not to verses: the App carries the canon's book names, abbreviations and chapter counts, not verse counts.
- Two screens: the study desk in the Vault workspace (`/vault/bible` — books tree, characters, concepts, talks, scoped graph) and a phone-shaped Dashboard screen (`/app/bible` — recent study, lookup, "Note on a verse…" in the `+` sheet).
- `[[John]]` is a plain title lookup across Linkable types; a Character named John and the Book John collide the usual way (the completer shows types; `[[bible_book:John]]` disambiguates).
