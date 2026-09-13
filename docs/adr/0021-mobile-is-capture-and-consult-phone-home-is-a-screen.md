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

**Riding the keyboard is the browser's job where it will do it.** There is no
portable keyboard height, and measuring one from the visual viewport is not
enough: on Android the first cut of this bar came up *under* the keyboard's own
toolbar row, which the visual viewport's shrink did not account for. So the
shell now asks for `interactive-widget=resizes-content`: Chromium ends the
layout viewport at the keyboard, the `h-dvh` frame ends there with it, and
anything fixed to the bottom — this bar, the phone nav — rides above whatever
the IME actually occupies, with no arithmetic and nothing for us to get wrong.

iOS ignores the hint and never shrinks the layout viewport, so the arithmetic
stays as the fallback: `useKeyboardInset` (Core, beside `useIsMobile` — a
browser fact, not shell furniture) reports `documentElement.clientHeight -
visualViewport.height - offsetTop`, measured against the initial containing
block because that, and not `window.innerHeight`, is the box a fixed `bottom`
resolves against. It reads 0 on Chromium, which is the same right answer.

The bar is portalled to `body`, since a `fixed` element is trapped by any
transformed ancestor and the editor sits inside sheets, and it is opaque and a
shade taller than the phone nav it lands on — while the editor has focus it
takes that row over. The editor takes the bar and the keyboard as a bottom
`scrollMargin`, so the caret is never scrolled to a "visible" position
underneath them.

The bar shows on focus and hides on blur, and its buttons `preventDefault` the
pointer down: a blur would close the keyboard and drop the selection the
commands act on. Focus is read from the editor's own `focusedField` rather
than `ViewUpdate.focusChanged`, and is now seeded when the view comes up
focused — CodeMirror announces focus *changes* only, so an `autoFocus`ed
editor (today's Journal) announced nothing, which had been leaving the daylog
widgets' focus reckoning wrong in the same way.

## Amendment (2026-08-31): the accessory bar stacks on the phone nav, it does not take its row

The amendment above had the bar land on the phone nav and take that row over
while the editor has focus. In use that is the wrong trade: the nav *is* the
phone's way out of the note — Menu, Home, Journal, Capture — and editing a
markdown body is exactly when you want to leave for one of them. Writing on the
phone meant losing the app's navigation until you dismissed the keyboard.

**Both rows, stacked.** From the bottom up: keyboard, phone nav, accessory bar.
The bar is fixed at `inset + nav height` instead of at `inset`, so the nav keeps
its own row and the bar takes another 48px from the text. That costs a line of
the note and buys back the whole nav; the note is scrolled, the nav is not
reachable any other way.

**The nav's height is measured, not assumed.** It carries
`env(safe-area-inset-bottom)`, which is real height on a notched phone and none
on the rest, so a constant would be wrong on one of them and put the bar back
over the nav. `MobileNav` observes its own box (`ResizeObserver`) and publishes
the number through Core (`setPhoneNavHeight` / `usePhoneNavHeight`, beside
`useKeyboardInset` — a layout fact, and the bar lives in another package with no
way to reach the element). It reports 0 when `md:hidden` takes the nav out, so
the bar falls back to its old placement wherever there is no nav at all.

**And the nav clears the keyboard on iOS.** Stacking is only worth anything if
the nav is on screen to stack on. Chromium ends the layout viewport at the
keyboard and the `h-dvh` frame with it, so the nav already rides above it there;
iOS never shrinks the viewport, so the nav sat *under* the keyboard — the row
was lost to the IME before the bar ever covered it. The nav now takes the
measured inset as its own bottom margin: the frame ends where the keyboard
begins, the nav is the last thing above it, and its safe-area padding drops
while the keyboard is up (the home indicator is behind it, so that padding would
only be dead height). The margin is 0 on Chromium, where this is already true.

Because the frame now ends above both keyboard and nav, the editor's bottom
`scrollMargin` is just the bar's height — the only thing left that covers text
the caret could be in.

## Amendment (2026-08-31): Screens are composed on the phone too

"Curation of the phone experience *is* Screen editing on the desktop" was the
original bargain, and it holds right up to the moment the phone home is wrong:
a card that is never tapped, one that should lead, one whose Stat was picked
months ago. Fixing any of it meant walking to a computer. Screen editing is
dense work, but *this* Screen is the phone's own page — the one surface where
the desk is the wrong place to sit. The fifth page to claim the parity clause.

**The same edit mode, minus the drag.** The header's actions (Add card, the
Edit/Done toggle and the ⋯ menu) were `max-md:hidden`; they are not any more,
and the header wraps below `md` so the Screen's name keeps its row while the
actions and the Tag filter take theirs. Everything the desktop's edit mode
does, the phone's does — add, configure, remove, the Screen's own Tag filter —
through the dialogs it already had, which are full-screen on a phone.

**Arranging is a strip under each card's title**, not a drag: ⌃⌄ to move a
place, −/+ to take a row off the card's height or add one, then configure and
remove. A drag would have to fight the scroll (the Schedule's long press,
bought there because a grid *is* the page), and a phone column has no width
to give — the one thing the strip cannot do is resize a card sideways, which
stays desk work.

**There is still one layout, and it is the grid.** The phone flattens it —
rows top to bottom, left to right within a row — so a move is the exchange of
two cards' grid slots (`moveStacked`, beside `stackOrder` in Core, both pure
and tested). Sizes travel with their cards, so swapping two unequal ones can
leave the desktop grid overlapping; react-grid-layout compacts that away on
render, in the new order. A per-breakpoint layout would have been the second
layout system this ADR refused, and the phone's order would then be a thing to
keep in sync rather than a reading of what is there.

**"Use as phone home" moves onto the Screen itself**, in that ⋯ menu, beside
Delete screen. It lived only in the sidebar's context menu — a right-click,
which is nothing at all on a phone — so the one choice this ADR calls "made
once, on the desktop" is now also makeable where its consequence is visible.

The grid's own rendering above `md` is untouched: same drag, same resize
handles, same title-row chrome. The two now share one `ScreenCard`, so a card
looks and behaves the same in both — the phone's strip and the desktop's
title-row buttons are what differ, and that is all.

## Amendment (2026-09-05): the caret rides in a band, and a note ends in a tail

The two amendments above hung a nav and a key bar over the foot of the editor
and gave the caret a bottom `scrollMargin` so it is never scrolled *underneath*
them. That is not the same as being able to write there. Two things were still
wrong while taking notes on a phone, and one of them is wrong at the desk too.

**The end of a note had nowhere to go.** A scroll margin can only ask the
scroller to scroll, and at the end of a document there is nothing below the last
line to scroll into: the last lines are wherever the scroller ends, which on a
phone is behind the accessory bar and the keyboard, and no amount of dragging
brings them up. The text one has just written is the text one cannot see. Every
document now ends in a **tail** — blank space after its last line, deep enough
to lift that line clear of whatever covers the foot and up into the page.

**And the line being written rode the bottom edge.** Scrolled into view by the
smallest movement that satisfies the margin, the active line lands exactly on
top of the bar: a toolbar under its chin, the keyboard under that, and nothing
of the note below it. The caret now keeps a **band** of text between itself and
either edge, so a line scrolled into view settles near the middle of the screen
and the note flows up past it as it is written. The band is the same above and
below — moving back up through the note parks the line at that same distance
from the top, rather than against it.

**One band, spent twice** (`caretRoom`, pure and tested beside `textDiff`):
as the scroll margins, and as the depth of the tail — so the last line of a note
can reach the same place every other line does. It is 40% of the visible text,
capped so that the two margins and a line always fit inside the box (margins
that leave no room for the line they are keeping in view scroll the view back
and forth over it), and it gives way entirely on a box too short to carve one
out of, where clearing the bar is all that is left. The editor's height is
observed rather than read once — the keyboard takes half the screen, the Fields
strip folds open, the phone turns — and the accessory bar's 48px are added to
the room below only where the bar actually is: a phone, with the editor focused.

**The desk gets both.** This is editor behaviour and not a phone layout — a
caret pinned to the bottom of the window is no better with a mouse — so the band
and the tail apply in both frames, sized from whatever box the editor has.

## Amendment (2026-09-05): one bottom bar per Workspace, and the header goes quiet while writing

This ADR gave the phone **one** bottom bar — `☰ · Home · Journal · +` — for the
whole app, from a time when the phone did one kind of thing. It no longer does.
ADR 0045 names the two kinds: the Dashboard is *operated*, the Vault is
*written in*. One bar serving both meant its four slots were split between two
jobs and did neither: `Journal` — a **Vault** screen — sat in a bar that was
otherwise Dashboard furniture, and the Vault's own contents (the tree, and the
folders one actually writes into) were reachable only by opening the ☰ drawer
and hunting.

**Each Workspace gets its own bar, and crossing between them is a slot.**

- **Dashboard:** `☰ · Home · Journal · Vault · +`. `Journal` keeps its slot and
  keeps routing into the Vault's Journal screen — "go to today" is a defined
  operation, which is the Dashboard's job; the writing that follows is the
  Vault's. `Vault` is the crossing.
- **Vault:** `Notes · Clippings · Writings`, plus ☰ and the crossing back. The
  tabs are **Folders**, per ADR 0045's second axis — where you go is a folder,
  what furniture you get there is the type's.

**Each tab remembers the last Document opened under it**, so returning to
Writings returns you to the writing, not to a list you have to re-navigate. This
is the same bargain the workspace switcher already makes by remembering each
workspace's last location (ADR 0012); the tabs are finer-grained.

The Workspace switcher stops being drawer-only. It was reachable on a phone
only inside ☰ — a hole this ADR's 2026-08-28 amendment already patched once,
by putting the whole frame in the drawer rather than just a sidebar. With two
bars the crossing is a slot in each, where it is visible.

**Journal is deliberately not a Vault tab.** Every other tab is a folder you
browse; `Journal/YYYY/MM` is auto-filed and dated and you never browse it — you
go to *today*. It is a date, not a place, so it fails the tab's own criterion
while passing the Dashboard's.

**And the editor's header goes quiet while you write.** Counted on a 390px
phone, a Note carried two rows of chrome above the text — a breadcrumb, then
the title with five controls beside it — and two below (the nav, and the
accessory bar once focused), leaving the text a minority of the screen. The
header now recedes while the caret is in the body and returns on a scroll up or
a blur. **Automatic, not a toggle**: a focus button is one more control in the
row being emptied, and a mode one can be stuck in without knowing.

Scrolling *up* is the ask, because it is already the gesture for "let me see
where I am" and there is nothing to tap while the header is away; scrolling down
is not its opposite — only typing puts the header back, with a few pixels of
slack so the caret band's own scrolling does not read as the user asking. The
header is collapsed rather than unmounted, so the title keeps its state and the
transition is what stops the text jumping under the caret, and it goes `inert`
while collapsed, or Tab walks into controls nobody can see. Like the caret band,
this is editor behaviour and not a phone layout, so it applies at the desk too.

**The nav and the accessory bar stay.** This amendment does *not* reverse the
2026-08-31 one — the nav is still the way out of the note, and losing it while
the keyboard is up is the exact failure that amendment exists to fix. The line
this draws: the header is chrome *about* the note, while the nav and the key bar
are **instruments in the hand**. Furniture recedes; tools do not. ADR 0045's type-derived
controls help less here than expected — a `note` declares a visible Field and is
linkable, so it keeps both of the controls that rule removes — which leaves the
receding header as the whole of the answer for a Note.

## Amendment (2026-09-07): the bar is the Workspace's Modules, and Home is per Workspace

The 2026-09-05 amendment above gave each Frame its own bottom bar. Workspaces
(ADR 0047) add a third axis to five slots, and ADR 0049 resolves it: the
middle of the bar becomes the Workspace's **Modules**, capped at three, with
the two switchers — Workspace and Frame — moving to the header.

That **supersedes the slot lists** of the amendment above, in both bars. Its
reasoning is untouched: the two Frames are used for different things and their
chrome should differ. It is now the Modules that differ rather than a fixed
list, and the Vault's folder tabs live inside the Note-taking Module's screen.
`Journal` loses its slot and stays a capture Command, one tap away.

**"At most one Screen holds the phone home, on every device alike" becomes at
most one per Workspace.** Switching Workspace on the phone therefore changes
what Home *is* — the most OS-like gesture in the design, for one field. The
rest of this ADR's phone-home bargain is unchanged: Home is a user Screen, its
Cards stack in one column, and it is composed where it is read (2026-08-31).

The parity clause is unchanged and still the rule: a page earns phone tuning by
being used on a phone. Nothing here grants parity to anything.

## Amendment (2026-09-13): the slack was not enough to tell a finger from a reflow

The 2026-09-05 amendment above gave the receding header "a few pixels of slack
so the caret band's own scrolling does not read as the user asking". That slack
was sized against the band's steady-state nudge, and the same amendment
introduced something an order of magnitude larger: **collapsing the header
resizes the editor's box**, by around 160px, on every frame of a 200ms
transition. The caret band is a fraction of that box, so each frame re-lays the
caret out and scrolls the scroller far past eight pixels.

That closed a loop. The collapse scrolled up; the scroll read as the user asking
for the header back; the header came back, which resized the box again, which
scrolled again — and the line being written oscillated up and down for as long
as the caret stayed in the body.

**The rule is now cause, not distance.** CodeMirror offers no "this update
scrolled the view" flag to separate the editor's own reflow from a gesture, so
the editor stamps when its box last moved — on a real height change, and on the
margins being reconfigured — and a scroll landing within a short settling window
of that stamp is not the user. The slack stays; it still covers the band's
ordinary nudge while the box is still. `isUserScrollUp` holds both rules as one
pure function, beside `caretRoom`, for the same reason: the arithmetic of where
the caret sits is the part worth testing.

Nothing about the amendment's intent changes — scrolling up is still the ask,
typing still puts the header away, and the nav and the accessory bar are still
untouched.
