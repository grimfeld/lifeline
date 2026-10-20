---
status: accepted
---

# A Macro composes existing Commands and stops on refusal rather than rolling back


We wanted one Command, or one Key binding, to do several things: a morning routine, a coffee that is both a spend and a Stat.

A **Macro** is a user-made Command whose steps are other Commands, in order. Each argument of a step is fixed, asked when the Macro runs (all at once, before the first step), or taken from what an earlier step made. A Macro has no verb of its own: every step still goes through the App that owns it, so ownership and guarded Fields stay as they are. A step is never another Macro, and a step that navigates comes last. A Macro is a Command like any other: in the palette, bindable to a key, headless when all its steps are, and capture (so pinnable on the capture sheet) only when every step is capture and none navigates. Macros are global Core bookkeeping, like Views. Only the user or an agent starts one; nothing runs on a schedule or a trigger.

**It checks, then stops; it never rolls back.** Before the first step, a Macro checks that every step can be given what it needs, and does not start otherwise. It is shown as broken until mended. A refusal that only running can reveal (a mood already set today) stops the Macro at that step, unless the step is marked *skip if refused*. Steps already done stay done. Every run ends in a dialog reporting each step as done, skipped or not reached.

**Built-in Macros are handed over once.** Lifeline seeds each built-in (a morning one: set today's mood, skip if refused, then go to Today) as the user's own Macro. The user may edit it, reset it to how it shipped, or delete it for good, and it is never seeded again.

## Considered options

- **Steps that are their own small actions (set a field, make a Document)**: rejected. They would bypass the owning App.
- **Rolling back the steps already done**: rejected. Command runs have no undo (only deletes do, ADR 0079), and adding one to every Command is far out of proportion.
- **Built-ins as code defaults with the user's edits stored on top**: rejected. A new release would change a Macro under the user.
- **Schedules and triggers**: out of scope. That is an automation engine, with runs nobody watches.
- **A toast on success, a dialog only on failure**: rejected. The user wants to see that every step ran.
