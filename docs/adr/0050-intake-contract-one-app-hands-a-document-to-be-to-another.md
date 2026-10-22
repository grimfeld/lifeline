---
status: accepted
amended-by: ADR 0073 (in part — the Handoff gains an origin Document), ADR 0080 (in part — a Handoff may come from outside Lifeline), ADR 0086 (Intake)
---

# Intake: one App hands material to another, which makes its own Document through its own form

Mail needs to turn a message into a Clipping, a Task or an Event. No App imports another (ADR 0001, 0031), Commands take no arguments, and the receiving App must stay the one that writes its Documents. So Core gains a fourth behavioural Contract after Schedulable, Timed and Loggable: **Intake**. An App declares the Intakes it offers — a label ("Clipping", "Task", "Event") and a dialog — and any App may hand a **Handoff** (title, markdown text, origin URL, author, date) to one of them; Core opens the receiver's dialog prefilled with the Handoff, and nothing is written until that dialog saves. The sender lists the Intakes Core knows and never names a receiver.

Loggable was not reused: it writes a fact into an existing target with no form in between, while an Intake is a *draft* of a new Document that the user finishes in the receiver's own vocabulary — the Clipper keeps the text as body and asks nothing, Tasks takes the title and puts the origin in the note, Calendar asks for the time. Extending Commands with prefilled arguments was considered and deferred: it is a Core palette feature in its own right, and a Command's dialog still would not know what to do with a text it did not ask for.

## Consequences

- `AppManifest.intakes?: IntakeDef[]`; Core lists them in registry order (`allIntakes()`); the sender renders the chosen Intake's own dialog with the Handoff.
- Clipper, Tasks and Calendar implement it; their existing dialogs gain an optional `handoff` prop and are otherwise unchanged.
- A Handoff carries no receiver-specific field; a receiver that needs more asks in its dialog.
