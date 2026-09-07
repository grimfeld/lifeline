# Modules shelve Apps, Workspaces are assembled from them, and the old Workspace becomes the Frame

ADR 0041 gave the sidebar **Nav groups**: shelves of App screens, Core-owned,
and explicitly *not* containers — "a group is never a container, an App never
belongs to one". That rule was written to keep grouping about the sidebar's
length rather than about ownership. It has never once been exercised: all 22
Apps put every screen they have in exactly one group. The distinction it
protects is real in principle and empty in fact.

So the shelf becomes a container. A **Module** holds Apps — Money, House,
Tasks, Schedules, Culture, Note-taking, Progress — and a **Workspace** is a
user-created, named set of Modules. "Work" takes Tasks and Schedules; "Study"
takes Note-taking and Culture. Core owns the Modules, fixed in code as
`NAV_GROUPS` was; the user owns the Workspaces. Nobody needs a "Work" Module,
because a Work Workspace is the thing they wanted.

**A Module carries chrome and only chrome.** Into a Workspace it brings its
Apps' screens and the Bases of the types those Apps own. It brings nothing
else: a Module never gates a Surface, the Vault, the command palette or a
Screen's card picker. Those work across Apps by Contract — ADR 0001's whole
premise — and a Schedule that hid Tuesday's Chores because this Workspace
lacks the House Module would be lying about Tuesday. The Chore still happens.
Hiding it is separation's job (ADR 0048) or nobody's.

The one thing a Module does gate beyond a sidebar is **every list of things to
run**: the phone's capture sheet shows this Workspace's Modules' capture
Commands and no others. That needs no new principle — a list of Commands is
chrome like any other list. It never gates the *ability* to create; the palette
still reaches everything, as ADR 0041 established.

## The word "Workspace" changes hands

ADR 0012's Workspace — the Vault/Dashboard axis — is renamed the **Frame**.
Every other tool in this space uses "workspace" for a user-created container
you switch between, and a glossary that fights the word its user reaches for
loses; the cost was 94 occurrences across 12 files and six ADRs, which is an
afternoon.

The Frame keeps everything ADR 0012 and ADR 0045 decided — Core owns the
switcher, an App declares which Frame its screens live in, the Vault writes and
the Dashboard operates. Only the noun moved. The doctrine that matters lives in
the **Vault** and **Dashboard** glossary entries where it is actually read; the
collective noun only has to name the slot, and it is better modest than
claiming "a way of working" beside a Workspace that now genuinely means that.

The two axes are orthogonal: **every Workspace has both Frames.** The Frame is
a fact about how you are working right now, the Workspace about what you are
working on.

## Screens belong to a Workspace

Separation (ADR 0048) is off by default, and without this a Workspace would
differ from its neighbour only in the length of its sidebar — all the plumbing
for the idea and none of the result. So a **Screen belongs to the Workspace it
was made in**, separated or not: its own dashboard, its own arrangement of
Cards. It falls out of separation anyway, since a Document card points at an id
that will not resolve in another Workspace, so this applies one rule where
there would otherwise be two.

`screens.phoneHome` follows: at most one Screen **per Workspace** holds it,
rather than ADR 0021's "at most one Screen, on every device alike". Switching
Workspace on the phone therefore changes what Home *is*, which is the most
OS-like gesture in the design and costs one field.

A Screen may also **claim a Module** (a `module` field beside `phoneHome`), and
is then where that Module lands — see ADR 0049.

## Considered options

- **Keep Nav groups as shelves and add Workspaces over Apps directly** —
  rejected: a Workspace would then name 22 Apps instead of 5 Modules, and the
  grouping users already read in the sidebar would be a second, parallel list
  that has to agree with it.
- **User-defined Modules** — rejected, for ADR 0041's own reason turned around.
  0041 refused user-defined groups because sidebar prefs are per-device and
  unsynced, so hand-built groups would not follow the user between devices.
  That objection does not reach the Workspace, which is synced — so the
  user-created thing is the Workspace and the shelves it picks from stay in
  code. Splitting the difference (both user-defined) would give two overlapping
  ways to express the same wish.
- **Modules gate Surfaces too** — rejected, and this is the option the ADR
  exists to close. It reverses ADR 0001, and it produces surfaces that lie: a
  Schedule missing half of Tuesday, a Today feed missing work that is due, a
  Daylog missing facts that happened. The wish behind it ("I don't want to see
  Chores at work") is real and is answered by separation, which removes the
  Chore from the Workspace honestly rather than hiding it from one view.
- **Modules gate creation as well as listing** — rejected: it makes a Module a
  data rule, which unpicks the whole decision above. The cost of leaving it
  open is that a separated Workspace can strand a Document of a type it has no
  screen for; the cost of closing it is two contradictory rules about what a
  Module is.
- **Keep "Workspace" for the Vault/Dashboard axis and call the new thing a
  Space** — rejected: it produces sentences like "the Study space's Vault
  workspace", and the user reached for "workspace" unprompted twice, including
  after "Space" was offered.
- **Collapse the Frame axis now that Workspaces exist** — rejected for ADR
  0045's reason, unchanged: two ways of working still want two chromes, and the
  Vault is cross-Module by construction (a body is edited there whatever its
  type), so it can never *be* a Module.

## Consequences

- `NAV_GROUPS` becomes `MODULES`; `AppScreenDef.group` becomes an App-level
  `module` — an App names one Module, not one per screen, since no App has ever
  wanted two.
- `WorkspaceDef` → `FrameDef`, `VAULT_WORKSPACE` → `VAULT_FRAME`,
  `workspaceOfPath` → `frameOfPath`, and so on across 12 files; the names
  `Workspace*` are freed for the new object.
- A new synced `workspaces` collection, and therefore a new entry in ADR 0039's
  three lists — the migration's, the owner hook's, and the collection rules.
  **A synced collection without `owner` is visible to every Account**, which is
  the failure 0039 exists to prevent.
- `screens` gains `workspace` (backfilled to the default Workspace) and
  `module` (nullable). `phoneHome`'s uniqueness becomes per Workspace.
- Views and user-defined types stay global: a View belongs to its Base, which
  follows the Module, and a type defined twice so it can be used in two
  Workspaces would be a bug. Placements and Attachments follow the Document
  they serve.
- The desktop sidebar keeps its shape — a Workspace picker at the top, the
  Frame switcher below it where ADR 0012 put it, Screens filtered to this
  Workspace, the Apps shelves renamed and filtered, Surfaces untouched. The
  desk is deliberately not the phone (ADR 0021), and the sidebar's length
  problem was already solved by closed-by-default shelves.
- **Bases group by Module**, which closes ADR 0041's explicit deferral: "its
  natural grouping is the owning App, which is a different rule from these
  shelves". It is no longer a different rule.
- Migration creates exactly one Workspace, **Personal**, unseparated, holding
  every Module and owning every existing Screen. A Workspace is mandatory and
  the last one cannot be deleted, so there is no second code path — and the
  upgrade is invisible until a second Workspace is created.
