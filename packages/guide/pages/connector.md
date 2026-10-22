# Claude

The **Lifeline connector** lets Claude (or any other assistant that speaks MCP) read your Lifeline
and, if you allow it, act in it: "what's on this week?", "add a chore to descale the kettle every
month", "tick off the bins".

## Connecting

- Add Lifeline as a connector in Claude, using your Lifeline connector's address.
- You sign in on Lifeline's own **Connect to Lifeline** page — Claude never sees your password.
- On that page, **Allow changes — create tasks and events, complete items, edit documents** decides
  the access:
  - **Unticked: read only.** Claude can look, search and read — nothing more. Tools that change
    things are not even offered to it.
  - **Ticked: read and write.** Claude can also add, complete, move and edit.

## What Claude never does

- It never sees the **Private folder**.
- It cannot delete anything.
- It works in one Workspace at a time — the default one unless it names another.

## What Claude can read and do

Lifeline's own tools, the same for every Module:

- `list_workspaces` — list your Workspaces.
- `list_types` — list the types of Document and their fields, and which ones it may create.
- `search_documents` — find Documents by words, type, tag or folder.
- `get_document` — read one Document in full: fields, tags, folder and body.
- `agenda` — what's on each day in a range: events, deadlines, time blocks, tasks, chores, with
  overdue items included. Optionally the Time blocker bands too.
- `guide` — read this Guide: the list of pages, or one page.
- `list_macros` — your [Macros](macros.md) with their steps, whether each is broken and why, and
  the tool that runs it. It can also list every Command a step may name.

With **Allow changes**:

- `complete_item` — tick off a task, a chore or anything else from the agenda.
- `move_item` — move a task or an event to another day, or a task back to the unplanned pool.
- `reschedule_timed` — give an event or a one-off time block a new day and time, or make it all
  day.
- `create_document` — make a note-like Document, or one of your own types.
- `update_document` — change a Document's title, body, tags, folder or plain fields. A rename
  rewrites the links to it. Guarded fields are refused — those change through the App's own tools.
- `create_macro` — save a new Macro from its name and steps.
- `update_macro` — rename a Macro or replace its steps.

Both check the Macro exactly as Settings → Macros does; one that would be broken is refused with
the reasons, and nothing is saved. There is no tool to delete a Macro.

## Your Macros as tools

With **Allow changes**, each Macro whose steps all work without a dialog is a tool of its own, named
after it (`macro_coffee`). Its arguments are the values the Macro asks when it runs, one per step
(`s1_amount` for step 1's amount). Running it does the steps in order, like the palette, and Claude
gets the whole report back: each step done (and what it made), skipped or stopped (with why), or not
reached. A broken Macro is refused before its first step. A Macro you add or rename shows up the
next time Claude asks for its tools — within a minute when you made it in the app.

## Each Module's own tools

Besides these, every Module's quick actions are tools too — `tasks_add`, `chores_add`,
`calendar_add_event`, `ledger_add`… Each does exactly what the same Command does in the app.
Every Module's page in this Guide lists its own under **Ask Claude**. They need **Allow changes**.

- Adding a *thing* that already exists (a Need, a Word, today's mood) is refused and reported, never
  overwritten.
- Logging a *record* (a spend, a fine, an entry) always adds a new one.

## Tips

- Dates are written `YYYY-MM-DD` and times `HH:MM`, in your own local time.
- Ask Claude to check the `agenda` before moving things around, and to ask before changing many
  things at once.
- Claude can read this Guide, so "how do I pin a capture command in Lifeline?" works too.

## Related

- [Documents](documents.md)
- [Workspaces](workspaces.md)
- [Calendar](calendar.md)
- [About the Guide](guide.md)
