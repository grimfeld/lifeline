---
status: accepted
amends: ADR 0003 (in part — the manifest gains `types` and loses `collections`)
supersedes: ADR 0009 (in part — the rejection of typed links), ADR 0014 (in part — the Taggable Contract)
superseded-by: ADR 0068 (in part — the prose Apps and their types), ADR 0070 (in part — the Clipping type)
---

# Document types: built-in and user-defined in one registry; Apps own built-in types and guard fields; Bases are generated

With one Document store (ADR 0018) we had to decide where types come from and what an App still owns. Types live in **one runtime registry with one shape** (field schema, title rule, body policy, Contracts, internal flag) fed from two origins: **built-in** types defined in code inside the App that owns them, and **user-defined** types created in-app and stored in a Core collection. Each built-in type has exactly one owning **App**, which alone defines its behaviour — Contract hooks (Schedulable, Timed, Daylog), commands, rules — and marks **guarded** fields that only the App's operations may write; any App or generic tool may read any Document, and a **Base** (one per type, auto-generated, with saved Views) may bulk-edit plain fields but routes guarded ones to the owner or leaves them read-only. User-defined types have no owning App: Core's generic machinery gives them a form, a Base, the Vault editor, generic Cards (View / Document / Count) and the Contracts declarable from data alone (Linkable by title and alias; Locatable through a geo field). A Contract with behaviour hooks needs code, so it needs an App. Apps are never generated per type. Field kinds are fixed (text, long text, number, boolean, date, datetime, select, multi-select, url, geo, list of text, Link to another Document) and there are no formulas in types.

## Considered options

- Code-only types (ADR 0003 pattern) — rejected: the user wants to add a Reference type (person, organisation, recipe) from the UI; the Notes App had already grown user-defined note types, proving the need.
- Data-only types (seed built-ins as data) — rejected: Apps need static TypeScript types for their logic and Contract hooks.
- Apps as pure processors over a shared pool — rejected: it reintroduces the cross-app coupling the merge (ADR 0001) exists to avoid; "who decides what completing a Chore means" must have one answer.
- Several Apps hooking the same type — rejected: ambiguous ownership the first time two hooks disagree.
- Type inheritance (`clipping` and `writing` extending `note`) — rejected for now: a complexity cliff; "all prose" queries are served by a Base/Contract over bodied Documents instead.

## Consequences

- `person` and `place` leave the Notes App and become user-defined types (the test that the generic path is good enough); they graduate to a built-in type only when a behaviour appears (e.g. birthdays as Timed).
- Three prose Apps each own one type: Note taker → `note`, Clipper → `clipping` (paste-only, with source), Writer's pad → `writing` (+ internal `version` type for manual snapshots). "Reference" and "Taggable" are not types or Contracts: being Linkable is what makes a Reference; every Document has Tags by construction.
- The App manifest (ADR 0003) gains `types` and loses `collections`; adding a type is "add a type definition and its Base appears".
- Wikilinks resolve across every Linkable type (exact title, then alias, optional `[[type:Name]]` prefix; target pinned once resolved), reversing ADR 0009's rejection of typed links now that many types share a namespace.

## Amendment (Aug 2026): one type per medium

The single `media` type is split: each medium (book, comic, movie, series, music, game) is its own built-in Document type, all owned by the one Media App — the row's `type` is its medium and the `medium` field is gone. This trades one Base with a Medium column for six Bases (what the user wants to browse), keeps every screen/card/rule shared in the App, and exercises the "one App owns several types" shape. `FieldDef.linkType` widened to `string | string[]` so a Quote still links to any medium. Apps are still never generated per type — the six defs are one loop over the media registry.

## Amendment (2026-10-22): two more field kinds

The fixed field kinds also include `links` (a Link holding several Documents) and `json` (an opaque structured value, shown but never edited generically): `FieldKind` in `packages/core/src/documents/types.ts`.
