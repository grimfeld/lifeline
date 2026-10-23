---
status: accepted
superseded-by: ADR 0057 (in part — "off by default")
---

> "Off by default" is superseded by ADR 0057: the first Workspace is the default and every one made after it is separated; it is not a choice (`separatedWhenCreated` and `createWorkspace` in `packages/core/src/workspaces.ts`). The rest stands.

# Workspace separation is a sealed box, and no type is exempt

A Workspace (ADR 0047) may keep its content to itself. The option is **off by
default**, and the decision here is what "to itself" means once it is on.

**A strict partition.** Every Document is either **shared** or **held** by one
separated Workspace — a single field, empty for shared, exactly as a Folder is
root when empty. A Workspace reads one of those and no other: an unseparated
Workspace sees the shared content, a separated one sees only what it holds.
Unseparated Workspaces all read the same shared content, which is why
separation is the thing that isolates and Modules never are.

The read is therefore one equality, not a union — `doc.workspace === scope`,
where `scope` is the Workspace's own id when it is separated and empty when it
is not. It goes in the one place every read already passes through:
`visibleUnder(rows, privateGate())` in `documents/store.ts`, the choke point
ADR 0038 built for the Private folder. Same shape, same mechanism, one more
clause.

**A separated Workspace does not also see the shared content.** This is the
part with teeth, and it was chosen over the alternative deliberately. It means
turning separation on **starts the Workspace empty** — every Document you own
is outside it — and content crosses only by being **moved**, one deliberate act,
the way a Document moves between Folders. The move operation is therefore not
optional: a box you cannot put anything into is a box you cannot use.

## No type is exempt

Roughly half the ~45 built-in types are library-shaped rather than facts:
Exercise, Product, Shop, Account, Category, Rule, Stat, Chore, Habit, Negative,
Artist, the Event and Blocker templates, and the Bible's Books, Chapters,
Verses, Characters and Concepts. A separated Workspace starts with none of
them and curates its own.

That sounds harsher than it is, and where it does bite it is usually right:
the reason to separate a Money-bearing Workspace is precisely that its Accounts
and Categories should **not** be the personal ones. Sharing them would be the
bug. And what is genuinely universal repairs itself — the Bible App derives
Verses, Characters and Concepts from the names it finds in bodies (ADR 0032),
so a fresh Workspace regenerates them by being used rather than importing them.

## Considered options

- **A private overlay** — a separated Workspace reads *shared + its own*, so
  turning separation on hides nothing and only changes where new content lands.
  Rejected in favour of the sealed box, though it is the closer call of the two
  and has two real advantages: the toggle is non-destructive, and it needs no
  migration UI on day one. The sealed box was chosen because "separate" should
  mean separate, and because the union read it requires is the same read a
  `shared: true` flag would force — see below. The cost accepted with it is
  that the move operation ships in the first release, not the second.
- **`shared: true` on a Document type**, exempting the libraries — rejected,
  and this is the option most worth arguing against. It turns the read back
  into a union (`pool === current || type.shared`) with a per-type
  configuration surface bolted on top: strictly worse than the overlay above,
  which at least gets the union without the config. It also makes every one of
  the ~45 types a judgement call, forever, with an answer that differs per user
  and per Workspace — and it is wrong on its own terms for the types people
  reach for first, since separate Categories and separate Accounts are the
  point.
- **Copy the libraries in at Workspace creation** — rejected: it is a one-time
  guess that goes stale, and it produces two diverging copies of an Exercise
  library with no way to tell which is which. The move operation does this
  honestly and on demand.
- **A second Account** (ADR 0039) instead of separation — rejected as the
  general answer, though it remains the right one for genuinely separate
  people. One device holds one Account at a time and switching requires erasing
  local data; the whole point of a separated Workspace is that both sets live
  on the device at once and switching is a tap.

## Consequences

- `documents` gains a `workspace` field, empty for shared. It joins ADR 0039's
  three lists as any synced change must.
- `visibleUnder` takes the Workspace scope beside the private gate. **Nothing
  outside Core may read around it** — the same rule ADR 0038 set, for the same
  reason.
- **A move operation is required in the first release**, not deferred: bulk
  from a Base, single from a Document. Without it a separated Workspace is
  unusable.
- ⚠️ **The singleton lookups become per-Workspace and must be scoped.** ADR
  0039 replaced fixed-id singletons with "the one Document of that type" —
  Arcade, Cinema and Library each keep a `SETTINGS_TYPE` row, and
  `private.ts`'s `settingsRow()` does `where("[type+deleted]").first()`. Under a
  partition "the one Document of that type" silently becomes one *per*
  Workspace. Every such lookup must take the scope or it will return another
  Workspace's row. Four call sites today, and a nasty class of bug if missed.
- ⚠️ **Attachments are referenced by name and unique per Account.** Left
  global, a held Document can embed another Workspace's image — straight
  through the boundary this ADR declares sealed. They follow the Document that
  embeds them, and the uniqueness rule narrows with them.
- Placements reference their Document by app + id, so gating the Document gates
  them — but the render path must be checked, or a placement row will draw for
  a Document that is not there.
- Deleting a Workspace **releases** rather than destroys: held Documents become
  shared, Screens move to the default Workspace, and only then does the
  Workspace go. This satisfies all three of the codebase's deletion rules at
  once — a container never takes down content with a life of its own (deleting
  a Workout keeps its Sessions), and the Workspace is the only thing here with
  no independent life. **Archiving was rejected** despite matching the Ledger
  Account's precedent: an archived sealed box is content reachable from
  nowhere, which the letter of the doctrine allows and its spirit forbids.
  Deleting the data outright stays available as two explicit steps.
- A separated Workspace can **strand** a Document of a type whose Module it
  does not hold — created through the Vault, which is never module-gated. The
  capture sheet does not offer this (ADR 0047) and the palette deliberately
  does; fencing it entirely would make Modules a data rule.
- The Vault, the Graph, search, the Daylog and every Surface are separated
  along with everything else, for free: they all read through the gate.
