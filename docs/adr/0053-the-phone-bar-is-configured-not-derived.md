# The Phone bar is configured, not derived

ADR 0049 gave the phone's bottom bar to the Workspace's Modules — `☰ · Home ·
up to three Modules · +` — and said so in the strongest terms available: that
this was "the whole of the 'different modules with their own navigation' ask
and is also what earns the Module its keep", since "everywhere else in this
design a Module only shortens a sidebar, which is thin justification for a new
primitive."

One release of using it says otherwise. The bar is **fixed on the left, fixed
in the centre, and the user's on the right**:

```
Calendar · Schedule · ✛ · [slot] · [slot]
```

Two things change at once, and they are one decision rather than two. The
**Calendar and Schedule Surfaces are pinned**, because the two views of time
are what a phone is taken out of a pocket for and neither should ever be
something a user had to have chosen. And **the rest is arranged by hand**, in
Settings, because the Module list was never a good predictor of the four or
five places a person actually goes.

## What the derivation got wrong

Not that it was unprincipled — it was the most principled thing in the design.
It was wrong in fact, in three ways this refactor had to take apart:

**The Module list is not a frequency list.** A Workspace holds Note-taking
because it wants the Vault's shelves in its sidebar and the Note types in its
Bases. That is a statement about chrome, which is exactly what ADR 0047 says a
Module is. Reading it as "and therefore this is one of the three places you go
most" is reading a fact about shelving as a fact about traffic, and the two
diverge immediately.

**The two Surfaces the phone exists for could never win a slot.** Calendar and
Schedule are Core's, cross-App by construction, and belong to no Module at all
— ADR 0047 is explicit that "a Module never gates a Surface". So the one bar
composition rule 0049 allowed was the one rule that could not reach them. A
user who lives in the Schedule got there through `☰`, every time, from a bar
whose stated purpose was primary navigation.

**The cap was pressure in the wrong direction.** 0049 argued that capping at
three Modules meant "a Workspace that holds everything is a Workspace that has
not been decided", and took that as a feature. In use it is a tax on the
sidebar: you drop a Module you wanted shelved so that your *bar* comes out
right, which is the Module deciding chrome you did not ask it to decide.

## What a slot holds

Any destination the sidebar offers — a **Module**, a **Surface**, a **Screen**,
an **App screen** — as a tagged reference, not a bare route. Not Modules only:
a user who wants the Week Surface should not have to take the Schedules Module
to get it, and a user who wants one App screen should not have to take the six
beside it.

The slot carries an optional **label**. The bar's cell is about 78px on a
390px phone at `text-[10px]`, and the sidebar's names are not written for it —
the Module is titled "Note-taking" and the user asking for it says "Notes".
The override belongs on the **slot** rather than on the thing it points at:
the bar is chrome, a phone-sized label is a fact about the bar, and putting an
`icon` or a short name on `UserScreen` to serve one 78px cell would leak a
phone concern into an object the desk shares. Icons resolve from the referent,
falling back to the generic Screen icon — which is what the bar already did
for an unknown Module.

This needs **a `SURFACES` registry in Core**, which should have existed
already: the five Surfaces were hardcoded JSX in the sidebar and were the only
one of the five kinds of page with nothing behind them. The sidebar, the bar
and the picker now read one list.

## The bar belongs to the Workspace

`workspaces.bar`, synced, per Workspace — not a per-device preference.
ADR 0047 settled this reasoning already, refusing user-defined Modules because
"sidebar prefs are per-device and unsynced, so hand-built groups would not
follow the user between devices", and putting the user-created thing on the
synced Workspace instead. A hand-built bar in `localStorage` walks straight
back into the objection 0047 closed.

It is also forced by the slot vocabulary: a Screen **belongs to a Workspace**
(ADR 0047), so a single global bar holding a Screen reference either breaks on
every Workspace switch or, under separation (ADR 0048), points at something
the Workspace may not read at all.

**A new Workspace seeds its bar from its own Modules** — Tasks and Note-taking
where it holds them, otherwise its first two in its own order. So the property
0049 actually wanted survives: switching Workspace still reconfigures the
phone. It is now the user's arrangement that travels rather than a derivation,
and the derivation is kept where it is harmless — as a starting point, once.

## A dead slot empties; nothing cascades

Two precedents existed and they disagreed. A Card whose Document is gone
renders `"Choose a Document…"` in place; a Module page the Workspace does not
hold redirects to `/` without a word. The bar follows the Card.

A slot whose destination no longer resolves — a deleted Screen, a Module
dropped from the Workspace — renders as an empty slot that opens the picker.
The bar always has five cells, so **`Calendar`, `Schedule` and `✛` never move
under the thumb** because of something that happened on the right. And
**removing a Module writes nothing to the bar**: re-seeding it would be a
silent rewrite of a deliberate arrangement as the side effect of a checkbox,
which is how configuration stops being trustworthy.

## Two things of 0049's that were only ever written down

**Per-Module memory is struck, not built.** 0049 said ADR 0021's per-tab
memory "becomes per-Module memory, which is the same bargain one level up".
Nothing implemented it; the only memory in the app is the Frame's and the
Vault Folder tabs'. It is not being built now either. Under 0049 a slot *was*
a Module, so "where I was in it" was coherent — but a slot the user aimed at
the Calendar Surface has nowhere to return to, and a slot labelled Notes that
opens a document is lying about where it goes. The Frame keeps its memory,
which is the crossing that earned one, and the Vault's Folder tabs keep theirs
inside the Note-taking Module page, where returning to the writing you were
editing is the whole point.

**Phone home is retired.** `screens.phoneHome` was synced, per Workspace and
uniqueness-constrained, and ADR 0047 called it "the most OS-like gesture in
the design" — but the app's root never consulted it. `HomeRedirect` went to
the first Screen by sort, and always had. Its only real reader was the bar's
Home slot, so with that slot gone the field has none. A Screen now reaches the
bar the way every other destination does: by being put in a slot.

## Settings

There was no Settings page, and that was not an oversight — Lifeline puts
configuration at the object it configures (a Card's settings on the Card, a
Base's fields on the Base, a Workspace's Modules on the Workspace picker's
dialog, "Erase local data" on the sync badge). The bar breaks the pattern for
a plain reason: it is a phone arrangement, edited on the phone, and
drag-reordering inside a `Dialog` at 390px is bad.

So `/settings` is a page — Core's, one per install, reached from the foot of
the sidebar. It is a **sixth kind of page**: the five that serve Documents are
Card, Screen, Surface, App screen and Base, and this one serves the app. Worth
naming so it is never mistaken for a Surface.

**Workspace management moves into it.** The bar is a field on the `workspaces`
record and is seeded from that record's Modules; leaving `WorkspaceDialog` to
edit the Modules while `/settings` edits the bar would put two front doors on
one record, coupled by a rule the user cannot see. The picker's "Manage
workspaces…" navigates to `/settings`.

## Considered options

- **Keep the derivation and add Calendar and Schedule as a fourth and fifth
  fixed slot** — rejected, though it is the smallest change that fixes the
  real complaint. It leaves one derived slot out of five, so the Module rule
  survives in name while governing almost nothing, and the cap becomes a
  cap of one.
- **Modules only in the custom slots** — rejected. It keeps a thread of 0049
  alive and is simpler, but it cannot express "the Week Surface, not all of
  Schedules", and it strands the phone's Screen behind the drawer with no way
  back onto the bar.
- **A per-device bar** — rejected for ADR 0047's own reason, above.
- **One global bar for every Workspace** — rejected: it bans Screen slots or
  it accepts dead slots on every switch, and it throws away the one property
  of 0049 worth keeping.
- **Auto-repair a slot when its Module is dropped** — rejected: a bar that is
  never gappy, bought with a silent write over a choice the user made.
- **Collapse to four slots when one is unset** — rejected: the cells spread to
  fill the width, so the three fixed ones move for an unrelated reason.
- **The bar editor inside `WorkspaceDialog`, no Settings page** — rejected on
  the 390px drag, and because the app will keep growing configuration that has
  no object to hang off.
- **Keep `phoneHome` and make `/` honour it** — considered seriously; it is
  three lines and it would make ADR 0047's claim true at last. Rejected
  because nothing else wanted it: with the Home slot gone, a synced field with
  a uniqueness rule would exist to serve one redirect that the first Screen
  already serves.

## Consequences

- ADR 0049 is **superseded in its slot list and its memory claim**. Its "where
  a Module lands" precedence survives intact and is now what a *Module slot*
  resolves to: a Screen of this Workspace claiming the Module, else a
  generated index, else straight through for a Module of one. So does its
  removal of `☰` and the Frame crossing from the bar's competition — `☰` goes
  to the header's top left, beside the Workspace picker and the Frame toggle
  that 0049 put there.
- **The Module keeps its keep, more modestly.** It shelves the sidebar's Apps,
  groups the Bases, gates the capture sheet (ADR 0047), is a destination a
  slot may point at, and seeds a new Workspace's bar. What it no longer is, is
  the phone's navigation by construction. 0049's claim that this was the whole
  justification for the primitive was overstated at the time; 0047 had already
  given it three jobs.
- `workspaces` gains `bar`, so **ADR 0039's three lists are untouched** — the
  collection already exists and already carries `owner`. A Workspace with no
  `bar` seeds on first read rather than in a migration, so there is no second
  code path for a row written before this.
- `screens.phoneHome` comes out of `UserScreen`, with the `/phone` route,
  `PhoneHomePage`, `createStarterPhoneHome`, `usePhoneHomeScreen`,
  `setPhoneHome`, the sidebar's badge and context-menu item and the Screen
  page's dropdown item. Existing rows keep a field nothing reads; it is not
  worth a migration.
- A fresh account has no Screens, so `/` now lands on `/calendar` — which is
  the bar's first slot. The starter phone-home Screen goes with the flow that
  created it.
- New `SURFACES` in Core (id, title, path) with `SURFACE_ICONS` in the shell
  beside `MODULE_ICONS`, so Core keeps no view dependency — the arrangement
  ADR 0047 already chose for Modules.
- The **desktop is untouched**, as 0049 also concluded: this is a phone answer
  to a phone problem. The sidebar gains one row — Settings, at its foot.
