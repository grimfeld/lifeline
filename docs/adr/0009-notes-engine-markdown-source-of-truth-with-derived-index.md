---
status: accepted
superseded-by: ADR 0018 (in part — "markdown is the source of truth"), ADR 0019 (in part — the rejection of typed links)
---

# Notes engine: markdown is the source of truth, everything else is a derived index

The Journal (an Obsidian daily-notes port) is built as the daily-note mode of a general Notes App, and the goal is to grow toward most of Obsidian's features over time. We copy Obsidian's architecture rather than its feature list: a Note is a title plus raw markdown, and wikilinks, backlinks, tags, headings, properties (frontmatter), aliases and unresolved links are a *derived index* rebuilt from the text on save and never hand-maintained. `[[Name]]` stays verbatim in the text and resolves live by name — note title, then note alias, then an entity of an App implementing the Core `Linkable` contract (Media title, Event, Chore, Task, Stat), else unresolved. Only the note text syncs; the index is local. Other Apps' facts enter a note through fenced `daylog` blocks rendered live from a second Core contract, `Daylog` ("what happened on day D"), never written into the text.

Note types are a compile-time registry (`NOTE_TYPES`: daily, person, place, plain — same pattern as `MEDIA_TYPES`, ADR 0006): title rule, typed properties schema rendered as a form but stored as frontmatter, template body. Rule of thumb: if it has behaviour it is an App; if it is prose plus a few properties it is a Note type. Person and Place start as Note types; graduating one to an App breaks no links because links resolve by name.

## Considered options

- Structured journal entries (mood, story, quote… as columns) — rejected: stops being markdown, breaks vault round-tripping, every template change is a schema change. Typed *properties* in frontmatter give the queryable bits without that cost.
- Core "Note" primitive — rejected: drags a domain into Core (ADR 0001).
- User-defined note types in-app — deferred: the same engine can grow it; a code registry is enough for one user who owns the code.
- `[[media:Dune]]`-style typed links — rejected: name resolution keeps Obsidian compatibility and vault import 1:1.
- Writing Daylog facts into the markdown at end of day — rejected: duplicates data and goes stale.

## Consequences

- Editor is CodeMirror 6 (Obsidian's own basis) so features arrive as extensions; reading mode is a remark pipeline with a wikilink plugin.
- Renaming a note rewrites `[[Old]]` in referrers; renaming an App entity does not (the link goes unresolved).
- Full-text search runs client-side over Dexie; storage in PocketBase is a text field with no cap.

## Amendment (Aug 2026)

User-defined Note types were deferred above and are now in: the built-in types stay in code (`BUILTIN_TYPES`), and a synced `note_types` collection layers user types on top (label, plural, icon name from a curated set, default folder, typed properties). Templates were already user-editable as `template` notes. `noteType(id)` resolves through a live cache so unknown/deleted ids degrade to plain. Apps may also expose commands derived from live data through `AppManifest.useCommands` — the Notes App generates one "New <type>…" palette command per type.
