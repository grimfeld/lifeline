---
status: accepted
---

> A Module's landing page of Cards is no longer fixed: ADR 0066 makes it an Overview, a hand-written default the user can rearrange. The rest stands.

# Modules are the product; the Rail is Core's only chrome

Every App lived next to every other in one chrome — the Dashboard's sidebar —
and an App contributed nothing to it but a row, a title and an icon. A chrome
general enough to hold Ledger, Workout and Mail is too general for any of them:
Money could not *feel* like money, because Ledger, Pocket and Prices were three
neighbours on a shelf. Screens were meant to be the answer — compose your own
page — and were not used: a blank grid of general-purpose Cards hands the user
the design work every time, with the most generic parts there are.

So the unit the user opens becomes the **Module**, and it is **hand-written**:
its own layout, its own navigation, written for its domain. Money's home may
put Pocket's Allowances beside the Ledger's Budget. Apps stay exactly what they
were underneath — the owners of their types, guarded fields and Contract hooks
— and supply the parts; the Module owns only the arrangement. Core keeps the
least chrome that still lets the user move: the **Rail**.

## The shape

```
Rail (Core)          | the open Module's own layout
─────────────────────┼──────────────────────────────
Workspace switcher   |
Modules              |   Money / House / Tasks / Culture /
─ ─ ─                |   Note-taking (the Vault) / Progress / Mail
general Surfaces     |
─ ─ ─                |
Bases · Screens ·    |
Settings             |
```

- **Top level is two kinds of thing**: Modules (products) and Core
  destinations (the general Surfaces, the Bases, Screens, Settings). Whatever
  the user opens is a Module; a Module of one App is fine (Tasks, Mail), since
  the layout is still the Module's.
- **The Frame is retired.** It was the Vault/Dashboard axis — what you *do*.
  Chrome now follows what it is *about*. The Vault survives as the Note-taking
  Module's layout and keeps its second job from ADR 0045: the one place a body
  is written. The Dashboard is gone.
- **Schedules is dissolved.** It held one App, Calendar, whose Events are only
  useful on the time Surfaces — which are Core's and already cross everything.
  A Schedules Module would have been the general Calendar minus everyone
  else's items. The Calendar App belongs to no Module: an App may, when it
  never needs a destination of its own.
- **Surfaces exist twice.** General, at the top level, showing everything the
  Contract reaches; and embedded in a Module, scoped to that Module's types.
  ADR 0047's "a Surface that hid half of Tuesday would be lying" holds for the
  general one, which never hides anything; the embedded one is openly a lens.
- **Bases are one top-level place**, raw and alike for every type. A
  user-defined type has no App and no Module, so a Base-per-Module home would
  leave it with none.
- **Screens are demoted to a side door.** They no longer claim Modules, and
  the app never opens on one.
- **A Workspace is a separate world of data**: the default reads the shared
  content, every other Workspace is separated (ADR 0048). The unseparated
  extra Workspace was only ever a shorter sidebar, and with a Rail of seven
  Modules there is no sidebar left to shorten. Its choice of Modules still
  decides which Modules stand on its Rail.
- **The phone bar is the phone's Rail** (ADR 0053, unchanged in its slots): Core
  owns going *between* places, the Module owns what is *inside*, so a Module's
  own navigation sits at the top of the phone screen and never takes the bar.
- **`/` resumes** the last place, per device and per Workspace, and falls back
  to the Schedule.
- **A Document has a Home Module** — its owning App's Module — where it opens
  all the way; from anywhere else it opens as a **Peek**, the owner's own small
  view, where the user is. Interconnection must not throw the user out of what
  they were doing.

## Considered options

- **One big Money App instead of a Money Module** — rejected. An App is an
  ownership boundary, not a UI one, and some of those boundaries are the point:
  "nothing in Pocket is ever a Transaction". The user-facing complaint was that
  the *product* unit was too small, and that is fixed one level up.
- **An App per chrome** — twenty-six layouts, and the jump between Pocket and
  the Budget, which belong together, would cross a chrome boundary.
- **Core-generated Module navigation** — the generic chrome again, one Module
  at a time.
- **An "Overview" place for the general Surfaces and Screens** — the Dashboard
  under a new name.
- **A top bar of Module tabs, or no global chrome with a launcher** — the first
  takes height from Modules that want a top bar of their own, the second makes
  switching slow. The Rail costs about 48px and dictates nothing to its right.
- **Letting a Module take the phone bar while open** — the bar would rearrange
  under the thumb, which ADR 0053 forbids.

## Consequences

- Supersedes ADR 0012 (two Workspaces / Frames) and ADR 0047 in what a Module
  is; ADR 0045's "Vault writes" survives, its "Dashboard operates" does not;
  ADR 0053's slots survive, pointing at Modules, general Surfaces and Screens.
- A Module becomes code: a manifest with its own layout, beside the App
  manifests in the compile-time registry (ADR 0003).
- **Rolled out Rail-first.** The Rail and the Module routes ship at once and
  the Dashboard goes on day one; a Module not yet hand-written gets a
  **stand-in** layout — its Apps' screens in a plain list, the old sidebar cut
  down to one Module — openly temporary. Then one Module at a time: Money, the
  Vault, Progress, House, Culture, Tasks and Mail.
