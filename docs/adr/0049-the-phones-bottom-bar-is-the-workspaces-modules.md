# The phone's bottom bar is the Workspace's Modules

ADR 0021 gave the phone one bottom bar, and its 2026-09-05 amendment gave it
two — one per Frame — because the Dashboard is operated and the Vault is
written in, and one bar serving both did neither. Workspaces (ADR 0047) add a
third axis to a bar that has five slots and, after `☰` and `+`, three usable
ones. Six things now want a place: the drawer, Home, capture, the Frame
crossing, Workspace switching, and Module navigation.

**The middle of the bar goes to the Modules.** Work is `☰ · Home · Tasks ·
Schedules · +`; Study is `☰ · Home · Notes · Culture · +`. The phone's primary
navigation is reconfigured by which Modules the Workspace holds, which is the
whole of the "different modules with their own navigation" ask and is also what
earns the Module its keep — everywhere else in this design a Module only
shortens a sidebar, which is thin justification for a new primitive.

**The bar caps at three Module slots**, in the Workspace's own Module order,
with the rest behind `☰`. So a Workspace holding six Modules is a worse phone
than a focused one. That is pressure in the right direction: a Workspace that
holds everything is a Workspace that has not been decided.

## Where a Module lands

Three rules, in precedence order, because the spread makes one rule impossible
— Note-taking holds six App screens and Tasks holds one, so an index is
necessary for the first and absurd for the second:

1. **A Screen of this Workspace that claims the Module** (`screens.module`,
   beside `phoneHome`). The user's own Cards. This is what makes a Module an
   *interface* rather than a menu, and it costs one nullable field because
   Screens already belong to a Workspace, already stack in one column on the
   phone, already have an edit mode and already have a designation mechanism to
   sit beside.
2. Otherwise a **Core-generated index** of the Module's App screens.
3. Otherwise — for a Module with exactly one App screen — **straight to it**.
   A menu of one is not navigation.

The claim is per Workspace, so the same Module lands differently in Work than
in Study.

## The two switchers move to the header

Workspace switching does not take a bar slot: the header carries the
Workspace's name, tapped to open a switcher sheet. You do not switch machines
from the dock.

**And the Frame crossing moves there with it** — which is the awkward part of
this ADR and is stated plainly rather than buried. ADR 0045's amendment spent a
bar slot on that crossing *one release ago*, for a good reason: reachable only
through `☰`, the Vault was a dead end on a phone. Giving the bar's middle to
the Modules takes that slot back. Without a replacement, a Workspace that does
not hold the Note-taking Module would reach the Vault only through the drawer
or by chancing on a Document with a body — the exact failure that amendment
exists to fix.

The header is the replacement, and it is a better place than the slot was: the
crossing stays visible, it costs nothing that the Modules want, and the phone's
header and the desktop sidebar's top now carry the same two controls. Symmetry
where it is cheap; difference where it is earned.

## Considered options

- **Workspace switching in the `☰` drawer header**, bars untouched — rejected:
  it is precisely the hole ADR 0021's 2026-08-28 amendment found ("the phone
  was stuck in whichever workspace it had opened") and its 2026-09-05 amendment
  paid a slot to close. Repeating a documented failure knowingly is worse than
  making it the first time.
- **Workspace takes a slot, Modules get no phone presence** — rejected: it
  keeps every existing crossing and answers "especially on mobile" with
  nothing. It is the honest fallback if the reversal above proves wrong in use.
- **A sixth and seventh slot** — rejected: 390px over eight slots is not a
  tap target.
- **The desktop sidebar mirrors this** (a Module rail, two levels) — rejected.
  ADR 0021's founding doctrine is that the desk and the phone deliberately
  differ and parity grows page by page. This is a phone answer to a phone
  problem — four usable slots — not a truth to propagate to a sidebar whose
  length problem ADR 0041 already solved with closed-by-default shelves.
- **Always an index, no pass-through** — considered and rejected, though it is
  the more consistent rule and iOS agrees with it (a folder holding one app
  still opens as a folder). Two taps to reach the only thing in the Tasks
  Module is a cost paid on every use to buy a consistency nobody will notice.

## Consequences

- ADR 0021's "one bottom bar per Workspace" amendment is **superseded in its
  slot list** — the Vault's `Notes · Clippings · Writings` folder tabs and the
  Dashboard's `Home · Journal · Vault` both give way to the Workspace's
  Modules. The reasoning behind that amendment survives intact: the two Frames
  are used for different things and their chrome should differ. It is now the
  Modules that differ rather than a fixed list, and Note-taking's Module screen
  is where the folder tabs go.
- `Journal` loses its slot. It stays a capture Command and a Surface, and is
  one tap from the Note-taking Module.
- The per-tab memory ADR 0021 added ("each tab remembers the last Document
  opened under it") becomes per-Module memory, which is the same bargain one
  level up.
- The three-slot cap needs an order, so the Workspace stores its Modules in the
  user's order rather than `MODULES` order.
- `screens.module` is nullable and per Workspace; a Screen claiming a Module
  the Workspace does not hold is simply never reached, not an error.
- The phone header grows two controls where it had none, which costs a row on
  every phone page. The editor's receding header (ADR 0021, 2026-09-05) already
  handles the case where that row is most expensive.
