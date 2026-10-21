# Macros

A **Macro** runs several Commands in order, as one Command. Open them in **Settings → Macros**.
They are yours across every Workspace and every device.

## Making a Macro

- **New Macro** — give it a name, then **Add a step** for each Command, in order: search for the
  Command, then say where each of its values comes from:
  - **Fixed** — the value typed here, the same every run;
  - **Asked when it runs** — every asked value, from all the steps, is asked in one form before the
    first step runs;
  - **What step N made** (for a link) — the Document an earlier step made, so a Note can be about
    the Source step 1 added. Only a step that makes a Document offers it: setting a mood makes none.
- **Skip if refused** on a step: when it is refused (today's mood is already set), the report says
  it was skipped and why, and the Macro carries on.
- A Command that only has its own dialog can be a step too: its dialog opens at its turn, and the
  Macro goes on once you save it. Close it without saving and the Macro stops there, the step
  reported **Stopped** (cancelled).
- A step that takes you somewhere (**Go to Mood**) must be the last one; the Macro cannot be saved
  otherwise.
- **Move up** / **Move down** reorder the steps; **Remove step** drops one. A step that took what
  another step made keeps following it as the steps move; when that step is removed, the value is
  left empty, for you to fill.
- Click a Macro to edit it. The bin deletes it at once; **Undo** in the message brings it back.

## Broken Macros

Before its first step, a Macro checks that every step can be given what it needs: its Command still
exists and is not another Macro (a Macro cannot be a step), each fixed value fits, a fixed link
names one Document, a step takes only what an earlier step made — into a link, from a step that
makes a Document — every required value is fixed or asked, and a step that takes you somewhere is
last. A Macro that fails is **Broken**: the list marks it, with each reason, until it is mended,
and run, it does nothing and says why.

## Running a Macro

- A Macro is in the palette (Ctrl+K) by its name, marked *Macros*, in every Workspace.
- A Macro whose steps all work without a dialog can also be typed on one line, with the marks of
  [Capture](capture.md): `!coffee amount:3` (an unmarked word fills the first text argument). A line with
  every asked argument runs the Macro and shows its report; a line missing some opens the up-front form
  with what you typed already in it.
- The up-front form checks every value when you press **Run**, and says under each field what is
  wrong with it.
- A Macro you gave a key runs from that key; see [Keys](keys.md).
- Each step is done by the App that owns it, exactly as its own Command would. When a step is
  refused (the thing is already on the shopping list), the Macro stops there, unless it is marked
  **Skip if refused**; the steps already done stay done.
- Every run ends with a report: each step **Done** (with what it said, and **Open** for what it
  made), **Skipped** or **Stopped** (with why), or **Not reached**.
- A Macro whose steps are all capture is on the phone's Capture sheet too; see
  [Capture](capture.md).

## Morning, the Macro you start with

Lifeline gives you one Macro to start with, **Morning**: it asks for today's mood and sets it
(skipped if it is already set), then goes to Today. It is yours like any other: edit it, or
delete it, and it never comes back, on any device. A new version of Lifeline never changes it.
**Reset to default** (the circular arrow beside it) puts back the name and steps it came with;
**Undo** in the message takes the reset back.

## Ask Claude

[Claude](connector.md) can run a Macro whose steps all work without a dialog, and list, create and
edit Macros, checked exactly as here. A Macro it makes appears here at once, yours to edit or
delete; Claude cannot delete one.

## Related

- [Keys](keys.md)
- [Capture](capture.md)
- [Settings](settings.md)
- [Claude](connector.md)
