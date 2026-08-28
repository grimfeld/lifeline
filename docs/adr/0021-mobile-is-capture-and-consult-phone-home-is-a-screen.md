# 21. Mobile is capture-and-consult; the phone home is a user Screen

Date: 2026-08-20

## Status

Accepted

## Context

Below desktop widths the app was unusable: both workspace frames hard-mount a
fixed sidebar beside `main`, no layout breakpoint existed anywhere, and the
only entry points (sidebar, Ctrl+K palette) need a pointer and a keyboard.

We could have adapted every route for phones (full parity), built a separate
mobile app, or narrowed the ambition. On a phone this app is actually used for
two things: recording something in seconds (clip, log entry, tick a chore) and
glancing at today. Dense surfaces (Schedule, week grid, Bases, Screen editing)
are desk work.

## Decision

**Mobile is a capture-and-consult subset, not parity.** Below `md` (768px) the
sidebars disappear and a bottom bar appears: **☰ · Home · Journal · +**.

- **Home is a user Screen, not a hand-written mobile page.** The user marks
  one Screen as the **phone home** (a synced `phoneHome` bool on the Screen;
  at most one holds it). On the phone its Cards render stacked in one column,
  read-only. Curation of the phone experience *is* Screen editing on the
  desktop — no second layout system.
- **Capture goes through Commands.** `CommandDef` gains `capture: true`; the
  "+" sheet lists exactly the flagged commands and opens their existing
  dialogs (full-screen below `md`). Owning Apps decide what is a capture
  command. Completing chores/tasks is not in the sheet — it's a tap in the
  due-today cards.
- **Everything else stays reachable, unadapted**, behind the ☰ drawer (the
  current workspace's sidebar in an off-canvas sheet). No "best on desktop"
  walls; dense pages simply render as they are.
- Touch ergonomics are one CSS layer: `@media (pointer: coarse)` gives
  buttons in the content area an enlarged invisible hit box.
- A minimal PWA manifest (icons, standalone display) makes it installable.
  Deliberately **no service worker** — offline shell loading is a separate
  decision; the Dexie data layer already works offline once loaded.

## Consequences

- The mobile subset is user-curated (which cards, which order) rather than
  hard-coded; new Apps join the phone by shipping cards and flagging capture
  commands — no shell changes.
- There is no mobile week view, schedule, or Base editing *by design*; the
  drawer keeps them reachable for emergencies. (The Schedule and the Week have
  since claimed the parity clause — see the amendments below; Bases have not.)
- `screens.phoneHome` is synced (PB migration 1756900000), so the choice is
  made once, on the desktop, and every device agrees.
- If parity is ever wanted, it grows page-by-page (a Surface at a time)
  without touching this frame.

## Amendment (Aug 2026): the Schedule Surface grows a phone layout

The first exercise of the "parity grows page-by-page" clause. Rendered
unadapted, the Schedule was not merely dense on a phone: a 13rem pool column
took over half the width, the seven week columns collapsed to ~25px each with
their headers overlapping, and no drag was possible because a touch that moves
scrolls. It is now a hand-fitted layout below `md`, desktop untouched.

**One day, always.** The week is desk work; below `md` the Surface renders the
anchored day whatever `?view=week` says, and the day/week toggle is hidden. A
**day strip** — the anchor's week as seven tappable date pills — replaces both
the toggle and the `<input type=date>`, so moving through the week stays one
tap and the week is still legible as context.

**The Unplaced pool becomes a drawer.** Same droppable, collapsed by default
above the grid (header row with a count), expanding to a capped, scrollable
list. Dropping onto the collapsed header still returns an item to the pool.

**Touch drag is a long press.** The `PointerSensor` is replaced by
`MouseSensor` + `TouchSensor` (220ms, 8px tolerance): a swipe scrolls the grid,
a press-and-hold picks a chip or block up. `pointer.current` is fed from
`touchmove` as well, since a touch activator carries no `clientY`. The resize
handle is the one `touch-action: none` element — it grows to 12px and shows a
grip on phones so its swipe-swallowing is visible rather than surprising.

**"+" replaces the double-click.** Double-clicking an empty slot has no touch
equivalent, so the phone header carries a "+" that opens the same New event
dialog at the current hour (9:00 on a day that is not today).

Detail work follows the same rule — space goes to the grid: a 2.5rem gutter
with bare-hour labels ("1 PM"), no day-header row (the strip names the day), a
shorter all-day strip, and blocks under ~34px keep the title and drop the clock
line.

## Amendment (Aug 2026): the Week Surface grows a phone layout

The second page to grow one. Rendered unadapted on a 390px phone, the Week was
the Schedule's failure again: the 14rem pool column took 57% of the width, the
seven day columns were **11px** each (headers overlapping, every card clipped to
a sliver), and — the `PointerSensor` again — no drag was possible. Desktop is
untouched; the phone gets a hand-fitted layout below `md`.

**The week becomes a stack of days.** Seven columns are unreadable at that
width, but the week is what this Surface *is*, so it is not narrowed to one day
as the Schedule was: the days become full-width rows, Monday to Sunday, scrolled
as one list. Each row's height follows its contents (empty days keep a short
"Drop here" target, so a whole empty week fits on one screen), today keeps its
border, past days keep their wash. The seven droppables are unchanged.

**The Unplaced pool becomes a drawer**, as on the Schedule — same droppable,
collapsed above the days, expanding to a capped, scrollable list. Overdue work
lives inside it, so its count rides on the closed header ("Unplaced 4 · 2
overdue") where it is the one thing that must not be buried. A drop on the
collapsed header still unplaces.

**Touch drag is a long press with a grip.** `MouseSensor` + `TouchSensor`
(220ms, 8px), the Schedule's bargain: a swipe scrolls, a press-and-hold picks a
card up. But a Week card is almost entirely its title button, and that button
opens the card's menu — so a phone card grows an explicit grip on its right edge
(`md:hidden`), and the title's tap keeps opening the menu, where "Move to day…"
remains the no-drag path. Completed cards show no grip; they cannot be dragged.

The header wraps into two rows (title/date/count, then filter + navigation), and
the Tag filter's picker gives way instead of running off the edge — it was
pushing the week navigation off-screen entirely on a phone.

## Amendment (2026-08-25): a third phone mode — operate

The Workout App's timer (ADR 0030) is neither capture nor consult: the phone
is propped on a bench and *operated*, hands mostly off. It is the first
phone-first App screen — full-screen digits, beeps and voice at 3-2-1 and
round changes, a wake lock, giant targets (pause, next, AMRAP round +1) — and
reachable from a "Start workout" Card on the phone home and from the `+`
menu. Editing Workouts, the Exercise library and PR tables stay desk work.
The rule stands: parity grows page-by-page, and a page earns phone tuning by
being used on the phone.

## Amendment (2026-08-28): the Writer's pad grows a phone layout

The third page to claim the parity clause, and the first App screen that is
neither capture nor consult but *writing*: prose gets written on a phone, in
the twenty minutes one has. Rendered unadapted it was the Schedule's failure
again — the desk's furniture around a column of text with nothing left for the
text. Desktop is untouched.

**The Writings desk stacks.** The header's one row (title, count, four status
filters, Base, New writing) ran off a 390px screen, so below `md` it becomes
two: title with a count and a compact `+ New`, then the status filter as a
scrollable strip. A row is one tap target — the whole row is the link, not the
title alone, since a phone has no hover to find the small one by.

**The pad gives the width to the text.** The generic editor's header wraps
below `md`: the title keeps a row of its own and the actions take the next.
The type Badge and the links-panel toggle are dropped there (the panel is
already hidden below `md`, and the Badge's Base is in the ⋯ menu). The Fields
+ Tags strip — status, project, tags, three quarters of a phone screen above
the first line of prose — folds behind a toggle in the header, closed by
default. The status Select leaves the pad's own toolbar on a phone; it is one
tap away in that strip.

**Versions become a sheet, a compared Version takes the screen.** A 16rem
column beside a 390px screen is not a column, so below `md` the Versions list
is a bottom sheet (the drawer pattern the Schedule and the Week already use),
and picking one closes it. Side-by-side compare is desk work: on a phone the
Version replaces the editor — hidden, not unmounted, so the text and the
cursor survive — with Restore and ✕ in its own header.

The pad does not grab focus on a phone: a Writing is opened to read as often
as to write, and a keyboard covering half the screen uninvited is the wrong
default. Tapping the text opens it.

**The editor's text is 16px below `md`.** iOS zooms any field under 16px on
focus and never zooms back; CodeMirror's 0.95rem was doing it on every tap
into the prose.

`useIsMobile` moves from the shell to Core: Apps growing a phone layout need
the breakpoint too, and it is a browser fact, not shell furniture.
