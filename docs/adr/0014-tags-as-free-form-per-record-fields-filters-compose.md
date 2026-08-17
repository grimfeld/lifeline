# Tags are free-form strings stored on each App's records; Tag filters compose Screen ∧ Card

Users want to group and filter across Apps ("only `garden` events on this Screen"). Two shapes were on the table for the vocabulary — a Core-owned `Tag` entity (ids, colour, rename/merge, referenced from entities) or free-form lower-cased words — and two for storage — a `tags: string[]` field on each App's record, or a Core-owned `{appId, itemId, tag}` join collection mirroring Placement. We chose free-form words on a per-record field: a tag is *part of the thing* and the owning App keeps owning it, the sync layer carries the field for free (no allowlist), one save = one LWW clock, and Notes' existing `#tag`-in-prose vocabulary is the same vocabulary with no bridge (a Note's tags are read from prose and its frontmatter `tags` list, never stored beside the text). Core owns no tag data — it derives the vocabulary through a Taggable Contract. Rename/merge is retagging; a colour map, if ever wanted, is a Core setting keyed by word, not an entity.

Filtering: a Tag filter is a *set*, matched any-of; a Screen filter applies to every tag-filterable Card on it and a Card's own filter narrows further (AND) — no precedence, nothing overrides. Untagged items never pass a non-empty filter. Cards opt in (`tagFilterable`); single-entity Cards (one Stat tile, one Event countdown) ignore filters.

## Consequences

- Five PocketBase migrations (`tasks`, `chores`, `events`, `stats`, `media`) add a `tags` json column; Dexie gets `*tags` multi-entry indexes. `Chore.category` is folded into `tags` and removed.
- Every Contract item placed on a Surface (Schedulable, Timed, Daylog, Pin, LinkTarget) carries `tags`, so read-side hooks can filter without a second lookup.
- Card settings gain a `tags` field kind; `UserScreen` gains `tags`.
- Normalisation on entry (trim, strip `#`, lower-case, spaces → `-`, Notes `TAG_RE`) guarantees any stored tag is a valid `#tag` in a Note.
