---
status: accepted
supersedes: ADR 0032
---

# The Bible App is retired

ADR 0032 made the Bible App a lens over Bible study, owning Verses, Chapters, Books, Characters and Concepts as Linkable hubs. With writing split into five Modules and every Note now needing a Source (ADRs 0068, 0070), the App would have needed rework to fit, and it is no longer used. It is retired rather than ported: its types leave the registry, its Cards and screen go, and study material is Notes and Quotes on Sources like any other. Talks stay as Essays marked by a `talk` Tag.

## Consequences

- Existing Verse, Chapter, Book, Character and Concept Documents must be migrated or dropped before the types leave; any body they hold is kept (as Thoughts or Notes) rather than lost.
- `[[John 3:16]]`-style links stop resolving to anything special and become ordinary wikilinks.
