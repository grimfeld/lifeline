# Documents: one structured store for everything

Lifeline had two data shapes: Notes (raw markdown as the truth, a derived index, ADR 0009) and every other App's typed Dexie/PocketBase collections (ADR 0002). The user wants an Obsidian-style vault *and* bulk Bases, wikilinks, Tag filters, Screens and Surfaces over Tasks, Media, Stats, Events — not only over prose. We make **Document** the universal record: every user-facing thing is a Document of exactly one Document type, stored as a **structured record** (`id, type, title, fields, body?, tags, folder, createdAt, updatedAt, deleted`) in **one `documents` collection** in PocketBase and one Dexie table, with per-type fields in a JSON column and a few promoted, indexed columns for hot queries (e.g. `day`, `stat`). The markdown body is one field; "frontmatter + body" is a *projection* for the Vault editor and vault import/export, not storage. Links, tags in prose, headings stay a derived index — now over the `body` field instead of a file. This supersedes ADR 0009's "markdown is the source of truth" and replaces ADR 0002's per-App collections; the sync engine (outbox, `updatedAt` cursor, tombstones, LWW, conflict copies per ADR 0010) is unchanged and now has one collection to page.

## Considered options

- Markdown files as the truth for everything (Tasks and Entries as files with frontmatter) — rejected: Stat Entries at volume become thousands of files and every Base query becomes a reparse; LWW and field-level edits need structure.
- Per-type storage (text-first types, record-first types behind one Document interface) — rejected: this is the duplication we are leaving, moved one level down; every generic feature (Bases, links, tags, Vault) would carry two code paths forever.
- One `documents` table plus side tables for heavy types (Entries) — rejected for now: Entries stay Documents and are the explicit volume test of the store; promoted columns and paginated sync are the mitigation. Revisit only if measured.
- Keeping Core's own records (Screens, Card instances, Placements, Views, user-defined type definitions) as Documents too — rejected: Documents are user-facing content; Core bookkeeping stays in its own synced collections so the Vault, link completion and Bases never have to hide them.

## Consequences

- Migration is a big bang: one script moves every existing collection into `documents`; all Apps flip at once. The old collections are dropped afterwards.
- Guarded fields (ADR 0019) are read-only in the frontmatter projection: edits to them in text mode are reverted on save with a notice.
- Full-text search, the Vault tree and the link index run over every Document with a body, whatever its type.
- Types may be **internal** (e.g. a Writing's Versions): stored like any Document, hidden from the tree, link completion and sidebar.
