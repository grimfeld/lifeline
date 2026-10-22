# Projects

Your work: outcomes you are working towards, and the Tasks that get you there — plus every
loose Task that belongs to no Project.

Projects has three places: **Projects**, **Timeline** and **Tasks**.

## Projects

A Project is an outcome you can declare finished — "Renovate the bathroom", "Plan the Lisbon
trip". It has a stage (**Planned**, **Active**, **Paused**, **Done**, **Dropped**), an optional
start and Deadline, Milestones, a Board, and the material that links to it.

- **The Projects page** — every Project by stage. As a **List**: Active ones large, with progress,
  Deadline and the **next Task**; Planned & paused below; Done & dropped folded away. As a
  **Board**: one column per stage — drag a Project to change its stage. Where: the first place in
  Projects.
- **New project** — name, **Outcome** (one line: what finished looks like), stage, start,
  Deadline, a face (emoji and colour, shown on its Tasks) and Tags. Where: **Project** on the
  Projects page, or the palette (Ctrl+K).
- **Go to Projects** — opens the Projects page. Where: the palette.
- **A Project's page** — its Outcome, stage, Deadline, progress and the estimated time left, then
  four tabs:
  - **Milestones** — the Project's checkpoints in your order, each with its progress and Tasks,
    then the Tasks under none. Type a name in **New milestone** and press Enter. Tick the circle
    to declare a Milestone reached; its menu edits (name, start, Deadline), moves it up or down,
    or deletes it (its Tasks stay in the Project).
  - **Board** — the Project's Tasks across its **Lanes** (it starts with To do, Doing, Done). Drag
    a Task between Lanes; order within a Lane is priority. **Add task** at the foot of a Lane adds
    one there. A Lane's menu renames it, makes it the **done lane** (a Task dropped there is
    ticked), moves it left or right, or deletes it (its Tasks go to the first Lane). Chips above
    narrow the Board to one Milestone. On a phone, a Task's **…** moves it a Lane or a place at a
    time.
  - **Material** — every Note, clipping, Receipt or Event that links to the Project, by type.
    Write `[[the Project's name]]` anywhere and it gathers here.
  - **Plan** — the Project's body, when it has one. **Plan** at the top opens it in the Vault.
- **Changing stage** — tap the stage badge on a Project's page. Finishing or dropping a Project
  with open Tasks asks what becomes of them: leave them open, archive them, or keep them as loose
  Tasks.
- **Finishing is yours** — ticking a Project's last Task, anywhere, offers **Finish project**; it
  never finishes it on its own.
- **Deleting** — in **Edit**. The Project, its Milestones and Lanes go; its Tasks stay as loose
  Tasks. To let a Project go, drop it instead.
- **Deadlines on the Calendar** — while a Project is Planned, Active or Paused, its Deadline (and
  each open Milestone's) shows as an all-day flag. Drag it to another day to change the Deadline.
- **Timeline** — Projects across the months, each a bar from start to Deadline with Milestone
  Deadlines flagged and today as a line. Page with the arrows or **Today**; **Done & dropped**
  shows ended ones. Where: the Timeline place.
- **Go to project timeline** — opens the Timeline. Where: the palette.
- **Active projects** — a Card: every Active Project with progress, Deadline and next Task. Where:
  a Card you can place.
- **Project** — a Card: one Project's Outcome and each Milestone's progress. Where: a Card you can
  place (pick the Project).
- **Project board** — a Card: one Project's Board, compact, still draggable. Where: a Card you can
  place (pick the Project).
- **Peek** — a Project opened from a link: change its stage, edit Outcome, start and Deadline, see
  its progress, next Task and Milestones, and go on to its page.

## Making and moving Projects by Command

Claude, the palette and Macros can run the same operations the Projects page does. There is no
Command to delete a Project: to let one go, drop it.

- **New project…** — also runs without its dialog, given a title and optionally Outcome, stage,
  start, Deadline, emoji and colour. A Project made this way starts with To do, Doing and Done
  lanes, like one you make by hand.
- **Edit project** — changes a Project's title, Outcome, start, Deadline, emoji or colour; only
  the fields you give.
- **Move project to stage** — moves a Project to Planned, Active, Paused, Done or Dropped.
  Finishing or dropping one with open Tasks is refused, naming how many are open, unless you say
  what becomes of them: `leave`, `archive` or `loose` (keep as loose Tasks), the same three
  choices as the stage dialog.

## Tasks

A Task is one piece of work: one-time (on a day, or **Unassigned** in the pool until you give it
one) or recurring (weekly, monthly or yearly). It may belong to one Project and one of its
Milestones.

- **The Tasks page** — tabs **Open** (Overdue, Today, Unassigned, Upcoming), **Recurring**,
  **Done** (the last 30 days) and **Archived**. The box at the top adds a Task to Unassigned on
  Enter. Where: the Tasks place.
- **A Task's menu (…)** — Edit, **Push**, **Move to day…**, Unassign, Archive or Restore, Delete.
- **New task** — title, type (one-time or weekly / monthly / yearly recurring), day, Project and
  Milestone, Estimate (minutes), notes and Tags. **Push** in the form saves and finds it time.
  Where: **New task** on the Tasks page.
- **Add task** — the same form from the palette or the Capture sheet.
- **Complete a task** — lists today's and overdue Tasks; tap each one you did. Where: the palette.
- **Plan the week** — opens the Calendar's Week view. Where: the palette.
- **Push** — finds the Task time in your Schedule: a Time block of its Estimate in the first free
  stretch (asking for an Estimate if it has none). See [Calendar](calendar.md).
- **Tasks today** — a Card: today's Tasks and anything overdue, ticked off in place. Where: a Card
  you can place.
- **Unassigned tasks** — a Card: the pool of Tasks with no day, with its own add box. Where: a
  Card you can place.
- **Completed recently** — a Card: what you got done over the last days (7 by default), by day;
  untick to undo. Where: a Card you can place.
- **Quick add** — a Card: one box, Enter adds a Task to the Unassigned pool or to Today (you
  choose). Where: a Card you can place.
- **Peek** — a Task opened from anywhere: Done / Not done, Push, Archive, and its fields edited in
  place.

Each repeat of a recurring Task is ticked and moved on its own. A missed one stops being overdue
once the next one comes round.

## Capture

The Capture sheet (the **+** in the middle of the Phone bar), under Projects, offers **Add task**.
Making a Project is deliberate, so **New project** is in the palette only.

## Ask Claude

Through the Lifeline connector, Claude can:

- Add a Task — on a day, in the pool, recurring, with an Estimate, Tags or a Project — "Add a task
  to call the plumber on Friday for the bathroom project", `tasks_add`.
- See and tick off what is due — "What's on today?", `agenda` then `complete_item`.
- Move a Task to another day or back to the pool — "Move the plumber call to Monday",
  `move_item`.
- Read a Project and what links to it — `search_documents`, `get_document`.

## Tips

- There is no priority field: the order of a Lane is the priority, and a Project's next Task is
  read from it.
- Work big enough to have parts is a Milestone or a Project, never a Task with subtasks.
- A Paused or Planned Project's Tasks still show on the Calendar on their own days.
- Give a Task an Estimate once and Push is one tap from then on.

## Related

- [Calendar](calendar.md) — Tasks on their days, Time blocks and Push.
- [Capture](capture.md) — the Capture sheet and pinning.
- [Screens and Cards](screens.md) — placing these Cards.
- [Links](links.md) — how material gathers on a Project.
- [Vault](vault.md) — writing a Project's plan.
