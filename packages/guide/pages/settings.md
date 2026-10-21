# Settings

**Settings** is where you set up Lifeline itself rather than anything in it. Open it from the foot
of the Rail, from the Workspace menu (**Settings…**), or from the phone's ☰ drawer.

Things that belong to something stay with it: a Card's settings are on the Card, a type's Fields
on its Base. Settings holds the rest.

## Account and sync

- Shows whether this device is synced, syncing, or has changes waiting ("· 3 pending"). Tap it to
  sync now.
- **Sign in to sync** — when signed out. Until you sign in, you work on this device's own copy and
  nothing syncs.
- **… · sign out** — sign out; this device keeps its data and you keep working locally.
- **Erase local data…** — delete everything stored on this device and download your account's
  data again. Anything already synced comes back; changes that never reached the server are lost,
  and it says how many.
- The same sync status sits at the foot of the Rail on the desk.

## Phone bar

The five slots at the foot of the phone. Calendar and Capture are fixed; the other three are
yours, per Workspace.

- Tap a slot to choose what it opens: a Module, a Surface, a Screen, or a page inside a Module.
- Give it a short label.
- **×** empties it.

See [Using Lifeline on a phone](phone.md).

## Capture pins

Up to six capture Commands kept on top of the phone's Capture sheet, and of the palette when it
opens empty.

- **Pin a capture command…** — pick from the list, grouped by Module.
- **Move up** / **Move down** to reorder; **Unpin** to remove.
- On a phone you can also hold an entry on the sheet to pin or unpin it.
- Pins belong to the Workspace.

See [Capture](capture.md).

## Keys

Give any Command a key of your own, so it runs on the desk without opening the palette.
**Keys** opens the list of them (**Settings → Keys**).

- **Bind a key** — pick a Command, then press the key that runs it. A key needs ⌘ (Ctrl off a
  Mac), with ⌥/Alt or ⇧/Shift if you like.
- Keys Lifeline already uses (⌘K, ⌘E, ⌘., ⌘1–9, ⌘↵) and the browser's own (copy, paste, new
  tab…) are refused. A key you already gave another Command shows as taken, with the Command
  it runs.
- Pressing the key runs the Command at once when it needs nothing more; one that asks for
  something (a mood, a title) opens its dialog; one that goes somewhere goes there.
- The pencil changes a binding; **×** removes it, with Undo.
- A binding whose Command no longer exists (its App was removed) is marked **Dead**: clear it.
- Keys are yours across every Workspace and every desk device. They do nothing on a phone.
- The palette shows a Command's key beside it.
## Macros

A **Macro** runs several Commands in order, as one Command. **Macros** here opens their own page.

- **New macro** — give it a name, then **Add a step** for each Command, in order: search for the
  Command, then say where each of its values comes from:
  - **Fixed** — the value typed here, the same every run;
  - **Asked when it runs** — every asked value, from all the steps, is asked in one form before the
    first step runs;
  - **What step N made** (for a link) — the Document an earlier step made, so a Note can be about
    the Source step 1 added.
- **Skip if refused** on a step: when it is refused (today's mood is already set), the report says
  it was skipped and why, and the Macro carries on.
- A Command that only has its own dialog can be a step too: its dialog opens at its turn, and the
  Macro goes on once it is closed.
- A step that takes you somewhere (**Go to Mood**) must be the last one; the Macro cannot be saved
  otherwise.
- **Move up** / **Move down** reorder the steps; **Remove step** drops one.
- Before its first step, a Macro checks that every step can be given what it needs: its Command still
  exists and is not another Macro (a Macro cannot be a step), each fixed value fits, a fixed link
  names one Document, a step takes only what an earlier step made, every required value is fixed or
  asked, and a step that takes you somewhere is last. A Macro that fails is **Broken**: the list
  marks it, with each reason, until it is mended, and run, it does nothing and says why.
- Click a Macro to edit it. The bin deletes it at once; **Undo** in the message brings it back.
- A Macro is in the palette (Ctrl+K) by its name, marked *Macro*, in every Workspace.
- A Macro whose steps all work without a dialog can also be typed on one line, with the marks of
  [Capture](capture.md): `!coffee amount:3` (an unmarked word fills the first text argument). A line with
  every asked argument runs the Macro and shows its report; a line missing some opens the up-front form
  with what you typed already in it.
- Each step is done by the App that owns it, exactly as its own Command would. When a step is
  refused (the thing is already on the shopping list), the Macro stops there, unless it is marked
  **Skip if refused**; the steps already done stay done.
- Every run ends with a report: each step **Done** (with what it said, and **Open** for what it
  made), **Skipped** or **Stopped** (with why), or **Not reached**.

## Dates in the palette

The palette's `/` reads dates in English and in French (see [Capture](capture.md)). A few words
mean different things in each: `/mar` is March in English and Tuesday (mardi) in French. Pick
**English** (the default) or **Français** to say which one wins. Words only one language knows
are read in that language whatever you pick. The choice is kept on this device.

## Workspaces

- Every Workspace, with how many Modules it has; a lock marks a separated one.
- Click one to edit it: its name, its Modules — or **Delete** it (with a confirmation).
- **New workspace** — a separate world that starts empty.

See [Workspaces](workspaces.md).

## The Demo

When you are trying the Demo, the first section is **Demo** instead of Account and sync:

- The Demo is filled with a made-up person's life, and today always has something on it.
- Everything you add, change or delete stays in this browser: no account, no sync, nobody else
  sees it.
- **Reset** — puts the Demo back to its starting life (it asks first).
- **Source** — a link to Lifeline's source code, where one is set.
- A banner at the top says you are in the Demo; dismiss it, and these stay here.

## Related

- [Workspaces](workspaces.md)
- [Using Lifeline on a phone](phone.md)
- [Capture](capture.md)
- [Getting around](index.md)
