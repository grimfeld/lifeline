# The sidebar shelves App screens into Core-owned Nav groups, closed by default

Twenty App screens had accumulated under one "Apps" header — Arcade, Bible quick, Events, Chores, Cinema, Clippings, Quotes, Discotheque, Ledger, Budget, Money reports, Library, Life Level, Museum, Pocket, Sources, Stats, Tasks, Workout, Writings — in registry order, which is neither alphabetical nor meaningful. Finding Budget meant reading the column.

Core gains **Nav groups**: a fixed, ordered list of shelves (`NAV_GROUPS` in the manifest) — **Planning** (Tasks, Chores, Events), **Culture** (Library, Cinema, Discotheque, Arcade, Museum), **Money** (Ledger, Budget, Money reports, Pocket), **Study** (Writings, Quotes, Clippings, Sources, Bible quick), **Progress** (Workout, Life Level, Stats). An App's screen names its group (`group: "money"`) and nothing else; Core decides which groups exist, what they are called and in what order they appear, exactly as it already decides the sidebar's sections. A screen naming no group, or one Core doesn't know, stays a plain top-level row — so an App added tomorrow is visible before anyone picks its shelf.

Groups **start closed** and open per device (`lifeline.sidebar.openGroups`, beside the collapsed sections and hidden Bases — localStorage, never synced). A group opens itself when you land on a screen inside it, whatever brought you there (sidebar, palette, link, deep URL), so the sidebar always shows where you are; from then on it stays open until you close it. The Apps section is five rows instead of twenty, and one row taller than that per group you keep open.

## Considered options

- **Groups open by default** — rejected: with five headers added and nothing folded, the sidebar gets *longer*, and the problem was length.
- **Groups own their Apps** (a group per App, screens nested under it) — rejected: it makes App a container in the chrome, when a group is a shelf across Apps — Ledger's three screens and Pocket's sit together under Money, and Bible's phone screen sits with the Writer's, whose Apps share nothing.
- **User-defined groups, dragged and named in-app** — rejected for now: sidebar prefs are per-device and unsynced (grill 2026-08-20), so hand-built groups would not follow the user to another device; Core's list travels with the code. Revisit if the five shelves stop fitting.
- **Alphabetical order, or most-recently-used** — rejected: it shortens nothing, and a sidebar that reorders itself can't be navigated by muscle memory.
- **Grouping the Bases too** — deferred: the Bases section is now the long one (one row per Document type), but its natural grouping is the owning App, which is a different rule from these shelves; it hides Bases per device already.

## Consequences

- `AppScreenDef` gains an optional `group`; `navSectionsOf(workspace)` folds a workspace's listed screens into `{ group?, screens }` shelves — loose screens first, then non-empty groups in `NAV_GROUPS` order — and the Dashboard sidebar renders that.
- Naming a group is one word in an App's manifest, and picking a *new* group is a line in Core; an App can neither invent a group nor reorder the list.
- Every App screen is two clicks away when its group is closed, one when open. The command palette (Ctrl+K) is unchanged and still reaches every screen by name in one step — the palette, not the sidebar, is the fast path.
- The Vault sidebar is unaffected: it lists its workspace's screens as buttons in a header row, and `navSectionsOf` is available to it if that ever grows.

## Amendment (2026-09-07): the shelf becomes a container

This ADR's central rule — "a group is never a container, an App never belongs
to one" — was written to keep grouping about the sidebar's length rather than
ownership. It was never exercised: all 22 Apps put every screen they have in
exactly one group, so the case the rule protects against (one App's screens on
two shelves) has never existed.

ADR 0047 promotes the shelf to a **Module**, a container of Apps, and makes it
the unit a Workspace is assembled from. `NAV_GROUPS` becomes `MODULES`;
`AppScreenDef.group` becomes an App-level `module`, since no App has ever
wanted two.

Two of this ADR's judgements survive and one closes:

- **Core owns the list** — reaffirmed, and by this ADR's own reasoning. User-
  defined groups were rejected because sidebar prefs are per-device and
  unsynced. That objection does not reach the Workspace, which *is* synced — so
  the user-created thing is the Workspace, and the shelves it picks from stay
  in code.
- **The palette is the escape hatch** — reaffirmed and load-bearing. A Module
  gates every list of things to run, the phone's capture sheet included, but
  never the palette.
- **Grouping the Bases** was deferred here because "its natural grouping is the
  owning App, which is a different rule from these shelves". It is no longer a
  different rule — a Module holds Apps, an App owns types, a type has one Base
  — so the Bases group by Module.
