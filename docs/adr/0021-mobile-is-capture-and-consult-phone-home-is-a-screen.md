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

## Amendment (2026-08-28): the drawer carries the whole frame, and the editor's panel is a sheet

"Everything else stays reachable behind the ☰ drawer" was not true of the
Vault. Three holes, all of them dead ends on a phone:

**The drawer showed a workspace's sidebar, not the workspace frame.** The
desktop mounts the Workspace switcher above that sidebar and the sync badge
below it; the drawer mounted neither. In the Vault — where the ☰ *is* the
sidebar — that left no way back to the Dashboard and no way to sign in: the
phone was stuck in whichever workspace it had opened. The drawer now renders
the same three pieces the desktop frame does, switcher included.

**The drawer closed on a link, and a sidebar is not made of links.** It
watched taps for an `<a>`, but the Vault's tree rows, search hits and tag
rows are buttons that navigate. Tapping a note opened it *behind* a drawer
that stayed put, so the tree read as broken. Closing is now driven by the
location changing, which covers every row whatever it is made of.

**The links panel had no phone form at all.** It was a `max-md:hidden`
column with a `max-md:hidden` toggle — backlinks, the local graph, the mini
map and every App's document panel were desktop-only, silently. Below `md`
the same panel is a right sheet (the drawer pattern again), opened by the
toggle that now shows on a phone; opening a link from it navigates, which
remounts the editor and takes the sheet with it. This reverses the Writer's
pad amendment above on one point: the pad's panel toggle stays on a phone.

The `max-md:hidden` column and its desktop toggle are untouched.

## Amendment (2026-08-29): the Bible study desk grows a phone layout

The fourth page to claim the parity clause. The Bible study desk (ADR 0032) is
consult work — the study is *read* on a phone as often as at the desk, and
"look up a verse" is the shortest errand the App has — but rendered unadapted
it was not merely dense: **the whole desk was 502px wide inside a 390px
screen** and scrolled sideways. One `grid` with an `auto` track took its width
from the widest thing on it, and that was the six-tab strip's min-content
(~486px); the strip's own `overflow-x-auto` therefore never engaged — it had
all the room it asked for. Everything else was dragged out to that width with
it: the lookup's Open button sat past the right edge, the last two tabs and
every row's date were off screen, and the graph showed three quarters of
itself — all of it reachable only by dragging the whole page sideways.
Desktop is untouched.

**The track is capped.** `grid-cols-1` — `minmax(0, 1fr)` rather than `auto` —
so no child's min-content can size the page. This is the whole of the fix for
the sideways scroll; the rest is fitting the page to the width it now has.

**The header stacks.** Below `md` the title takes a row and the lookup takes
the next, full width — an `h-9` field that grows and its button beside it,
rather than a 176px field pinned right. Above `md` the row is what it was.

**The tabs are a scrolling strip.** Six tabs never fit a phone, so the strip
scrolls inside the pill, clipped at the edge where the cut-off tab reads as
"there is more". Two things make it usable: `justify-start`, or centred
overflow puts *Study* out of reach past the left edge, and the chosen tab is
scrolled into view on every change — arriving at `?tab=graph` otherwise
showed the graph under a strip with no active tab visible on it.

**A row's meta stacks under it.** Title, excerpt, then the type and the date
on a small line of their own; a third column pinned to the right edge is desk
furniture, and it was the half of the row a phone never saw. The Scripture
tree's rows truncate their titles instead of pushing the chapter and mention
counts off the screen, and nest by 1rem rather than 1.5rem so a Verse row
keeps its width three levels down.

**The graph gets 60dvh below `md`** (70 above), leaving the header and the
strip on screen with it; the canvas already handles touch (`touch-none` plus
pointer events), so pan and drag work as they do with a mouse.

The phone's own Bible screen (`/app/bible`) is unchanged: it is capture and
glance, the desk is the whole study, and both now work at 390px.

## Amendment (2026-08-29): the editor grows a key accessory bar

The Writer's pad amendment above gave prose the width of the screen; it did
not make the syntax typable. Markdown on a phone keyboard is `[`, `[`, a name,
`]`, `]` — four of those five characters behind the symbols layer — and the
caret work around them is fingertip surgery. The question that prompted this
was whether the app could put up a keyboard of its own instead.

**It does not replace the keyboard.** `inputmode="none"` on the CodeMirror
content would suppress the OS keyboard in one line, and an app-drawn key grid
could feed the editor through transactions; a real system IME (an iOS keyboard
extension, an Android `InputMethodService`) is not even reachable — the phone
runs the PWA, and an extension would be a separate sandboxed app the user
enables system-wide. Either way the trade is the same and it is bad: autocorrect,
swipe typing, dictation, emoji, every non-Latin layout, and external-keyboard
and accessibility input, given up in order to type *prose*. The keyboard stays
the OS's.

**Above it goes a strip of the things the keyboard is bad at** — Obsidian's
bargain. One scrollable row of icon buttons, rendered while the editor has
focus below `md`. Its order is thumb-first: caret left/right and the `[[`
link lead, because those are what a phone genuinely cannot do otherwise; then
tag, heading, bold, italic, strikethrough, code, bullet, task, quote, outdent,
indent, undo, redo.

- **Linking is the point.** The link button wraps the selection in `[[…]]`,
  puts the caret inside and calls `startCompletion` — the same note picker the
  desktop gets by typing, with the selected words already as its query.
- **One button per chore, not per state.** Heading cycles none → `#` → `##` →
  `###` → none; the task button makes a plain line or a bullet into a task and
  ticks and unticks one that already is. Ticking is exactly what a fingertip
  cannot do to `[ ]`.
- **Marks toggle off.** A second tap unwraps, whether the markers are inside
  the selection or around it — but a marker that continues past the pair is
  read as a longer run, so italic inside bold nests (`***x***`) instead of
  eating the bold.
- The commands are plain CodeMirror `Command`s in `mdCommands.ts`, unit-tested
  on a bare `EditorState`; nothing in them knows about the bar, so a desktop
  keymap could take the same set later.

**Riding the keyboard is `visualViewport` arithmetic.** There is no portable
keyboard height: iOS never shrinks the layout viewport, so `bottom: 0` sits
*under* the keyboard, and `env(keyboard-inset-height)` is Chromium's half of
the answer. `useKeyboardInset` (Core, beside `useIsMobile` — a browser fact,
not shell furniture) reports `innerHeight - visualViewport.height -
offsetTop`, which is the keyboard on iOS and 0 where the layout viewport
already stops at it. The bar is portalled to `body`, since a `fixed` element
is trapped by any transformed ancestor and the editor sits inside sheets. The
editor takes the bar and the keyboard as a bottom `scrollMargin`, so the caret
is never scrolled to a "visible" position underneath them.

The bar shows on focus and hides on blur, and its buttons `preventDefault` the
pointer down: a blur would close the keyboard and drop the selection the
commands act on. Focus is read from the editor's own `focusedField` rather
than `ViewUpdate.focusChanged`, and is now seeded when the view comes up
focused — CodeMirror announces focus *changes* only, so an `autoFocus`ed
editor (today's Journal) announced nothing, which had been leaving the daylog
widgets' focus reckoning wrong in the same way.
