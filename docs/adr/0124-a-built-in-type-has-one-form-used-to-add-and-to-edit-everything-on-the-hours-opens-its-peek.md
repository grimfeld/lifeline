---
status: accepted
amends: ADR 0085 (the Peek's App part is the type's Form, editing), ADR 0056 (the timing Undo leaves on closing the Peek)
---

# A built-in type has one Form, used to add and to edit; everything on the hours opens its Peek

An Event was drawn by five forms: the Event dialog, its Peek, the hours editor, the add-at-an-hour popover and the arguments of `calendar.add-event`. Each held its own copy of the Fields, so a Field added to one (the Event's With) silently missed the others, and the user never saw it where they looked for it. The same pattern repeats across the Apps, with about 71 dialogs and 24 Peeks.

So **a built-in type has exactly one Form** (CONTEXT.md), drawn by its owning App and used in two modes:

- **Adding**: a draft nothing writes until it is saved. The add dialog and an Intake use it.
- **Editing**: written as it changes. The Peek (ADR 0085) uses it, or the type's page where it has one (ADR 0110).

An existing Document is edited only there. **Dialogs only add**, as ADR 0110 did for a work. Where the Form is opened from may show or hide parts of it, never draw Fields of its own. A Field added to the Form appears in the dialog and the Peek at once.

**Everything on the hours opens its Peek.** An Event, a Task's Time block, an untimed chip, a Time blocker band and another App's Timed item each open the Peek of their Document from the Schedule, Month, Upcoming and the Agenda Card. The Peek carries a **timing section** for what was tapped: for an Event it is the Form's own day and time Fields, grown with the hours editor's quick controls; for a block or a chip, the block's timing above the Task's Form; for a blocker or another App's item, what its App allows through the Timed hooks (ADR 0056), read-only where it cannot be moved. The hours editor is gone. An item with no Document (an iCal subscription's) shows a small read-only card.

**Closing a Peek leaves one Undo for the timing** changed while it was open, wherever it was opened from. This is ADR 0056's promise, moved from the sheet into the Peek. A removal keeps its own immediate Undo.

**An empty hour, or a swept range, opens the Event dialog** (the Form, adding) prefilled with that day and range. The dialog always offers the Event templates above the Form, and "Or place here" below it: Blocker templates and unplaced work, placed at the Form's day and start. While the Form is all day, the list asks for a start time instead.

A Command's arguments stay apart from the Form, since they are how a caller other than the user adds a Document. A test keeps them in step: every Field of a built-in type is an argument of its add Command, or is listed as left out with a reason.

## Considered options

- **One generic, schema-driven form for every type.** Rejected, for ADR 0085's reasons: guarded Fields move only through their owner's operations, and only the owner knows which controls fit its type.
- **Keep the hours editor beside the Peek for timing.** Rejected: it has no With, Notes or Tags, so the Event keeps two editors with different Fields, which is the problem.
- **Drop the templates and place from the empty-hour click.** Rejected: a usual Event stays one tap, and a Blocker template or unplaced work can still be placed at an hour on the phone.

## Consequences

- Each App moves to one Form in its own change, removing its edit dialogs in favour of its Peek (or page) and sharing the Form with its add dialog. The Calendar goes first.
- The hours editor and the add-at-an-hour popover are removed from the shell.
- A user-defined type's Form is Core's, as before.
