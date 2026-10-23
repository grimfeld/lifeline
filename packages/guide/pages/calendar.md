# Calendar

The one place for time: every dated thing in Lifeline — Events, Tasks, Chores, Deadlines and
more — on one calendar, in five views. Reach it from the Rail, or the far left of the Phone bar.

## Views

Switch views in place: tabs at the top on the desk, a menu under the title on a phone.

- **Upcoming** — a list running down the days from the day in view: all-day items and
  Deadlines, then timed things by start, then the day's work, tickable in place. Empty days fold
  into one "Nothing on" line. **Earlier** reaches back. It only reads and ticks — nothing is
  dragged here.
- **Day**, **3 Day** and **Week** — the **Schedule**: hours laid out, where you plan work into
  time. See below.
- **Month** — a six-week grid, each item on its own day. Drag an item to another day; tap a day
  to open it in Day view. On the keyboard, Tab to an item: **Enter** opens it, **←** / **→** move
  it a day and **↑** / **↓** a week.

All views share one **day in view**: switching keeps it. Page with **‹** / **›**, jump back with
**Today**, or pick a date (desk). On a phone, swipe sideways to page. The Calendar remembers the
view you last used on each device; on first open a phone shows Upcoming and the desk Week.

**Tag filter** — narrows every view to things with the Tags you pick. It never hides Time
blocker bands.

**Events** — the button beside the views opens the Calendar App's page (below).

## The Schedule (Day, 3 Day, Week)

- **Time blocks** — drag a Task or Chore (from a day's strip, or the Unplaced pool) onto an hour
  to plan it there. The chip stays, greyed, so you can block it again — a long Task can be split
  across days. A block never changes the item's own day.
- **Moving and resizing** — drag a block to another hour or day; drag its bottom edge to resize.
  Everything snaps to the quarter hour. Drag a block back to the strip or the pool to remove it.
- **Editing anything on the hours** — tap (or click) a block, an Event or a one-off blocker: change
  its day (**Tomorrow** is one tap), start (15-minute nudges) and length, or remove it. Changes
  apply at once; closing leaves one **Undo**. Removing a block keeps the Task; removing an Event or
  blocker deletes it.
- **Adding at an hour** — tap an empty hour on a phone, double-click on the desk: a **New event**,
  an Event template, a Blocker template, or a piece of unplaced work. On a phone, **+** in the
  Phone dock does the same at the current hour.
- **Event templates** — shown beside the hours: drag one onto an hour, or tap its bolt to put it
  on the day in view at its usual time.
- **Time blocker bands** — shaded hours you marked as taken (sleep, work). Weekly bands stay put;
  one-off bands can be dragged and resized like blocks.
- **Ticking** — ticking a block ticks the item itself: its later blocks go, its past ones stay as
  record.
- **On the keyboard** — Tab to a block, an Event, a chip or a one-off band: **Enter** opens it
  (the editor sets its length too; closing it brings you back to the item). **↑** / **↓** move it
  a quarter hour (an hour with **Shift**), **←** / **→** a day. A chip in a day's strip moves by
  the day only; **Enter** on an Event template puts it on the day in view.

## Push

One tap that finds an item time. Push makes a Time block as long as the item's Estimate in the
first free stretch — free of Events, other blocks and blockers — from now (or from the item's
day, if later), up to two weeks out. Push again and that block moves to the next free stretch
after it. With no Estimate, it asks "How long will … take?" first and remembers the answer.
Nothing free: nothing changes. Undoable.

Where: the Push icon on a chip or block on the Schedule, **Push** in an item's menu on Month and
Upcoming, and on Tasks (their menu, form and Peek). Offered on work with an Estimate — Tasks today.

## Work on Month and Upcoming

Tap a work item for its menu:

- **Complete**, **Push**, **Move to day…**.
- **Unplace** — back to the Unplaced pool (Tasks).
- **Unpin** — for an item that cannot really move (a Chore) and was pinned to a day by a drag:
  back to its own day.

**Unplaced** — the pool of work with no day, a column on the desk and a drawer on a phone. Drag
from it onto a day (Month) or an hour (Schedule).

## Events and the Calendar App

The Calendar App owns **Events** (things at a fixed time, or all day — not work, nothing to
tick), **Event templates**, **Time blockers** and **Blocker templates**. It has no Module: its
page is reached from **Events** on the Calendar.

The **Events** page has three tabs:

- **Events** — Today, Upcoming and the past 30 days. **New event** adds one: title, day, start
  and end, or **All day** (with an optional last day for several days), notes and Tags.
- **Templates** — **Event templates** (title, length or all day, usual start, notes, Tags), each
  with **Add today**; and **Blocker templates** (title, length, colour).
- **Blockers** — your Time blockers. A weekly one has a title, weekdays (or Every day / Weekdays /
  Weekends), from and to, and a colour; **Turn off** stops painting it but keeps it. One-off
  blockers (made by dropping a Blocker template on an hour) are listed too.

Commands and Cards:

- **Add event** — the event form. Where: the palette (Ctrl+K), the Capture sheet.
- **Add today: <template>** — one per Event template: puts it on today at its usual time, no
  form. Where: the palette; folded under **Add today…** on the Capture sheet.
- **Add event from a template** — the same, on any day and time, for Claude
  (`calendar_add_from_template`); not in the palette.
- **New event template** — the template form. Where: the palette, or the Templates tab.
- **New time blocker** — a weekly band. Where: the palette, or the Blockers tab.
- **New blocker template** — a reusable one-off band ("Travel 30"). Where: the palette, or the
  Templates tab.
- **Upcoming events** — a Card: the next two weeks of events. Where: a Card you can place.
- **Next events** — a Card: the next few events (5 by default) with a day countdown. Where: a Card
  you can place.
- **Countdown** — a Card: a big number of days until one event you pick. Where: a Card you can
  place.
- **Peek** — an Event opened from a link: its day and times, notes and Tags edited in place.

Editing or deleting a template never changes the Events it made.

## Also on the Calendar

- **Deadlines** — a Project's or Milestone's Deadline, as an all-day flag. Drag it to move the
  Deadline. A missed one stays red on its day.
- **Calendar subscriptions** — events from an iCal link, in its colour, read-only.
- **In a Module** — House shows a Calendar of its Chores only, in Month and Upcoming. A Module's
  Calendar keeps its own view and day.

## Capture

The **Calendar** group comes first on the Capture sheet: **Add event**, and **Add today…** with
each Event template under it. Pin a template you use daily to make it one tap.

## Ask Claude

Through the Lifeline connector, Claude can:

- Read what is on — "What do I have this week?", `agenda`.
- Add an Event — "Add dentist on Thursday at 14:00", `calendar_add_event`.
- Add one from a template — "Add Gym today", `calendar_add_from_template`.
- Move an Event or a Task to another day — `move_item`; retime an Event or one-off blocker —
  "Move the dentist to 15:30", `reschedule_timed`.
- Tick off work from the agenda — `complete_item`.

## Tips

- Use Upcoming on the phone for "what's next?", and Week at the desk for planning.
- A blocker is a guide, not a wall: you can still drop work over a band.
- Done work keeps its blocks as a record of where the time went; they can be removed, not
  retimed.

## Related

- [Projects](projects.md) — Tasks, Estimates and Deadlines.
- [House](house.md) — Chores and House's own Calendar.
- [Capture](capture.md) — the Capture sheet and pins.
- [Screens and Cards](screens.md) — the Agenda and Today Cards, and placing these Cards.
- [Phone](phone.md) — the Phone bar and dock.
