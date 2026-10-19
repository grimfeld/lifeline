---
status: accepted
amends: ADR 0050 (Intake), ADR 0073 (in part — selecting text offers every Intake)
---

# The Selection menu links and makes, and user-defined types take a generic Intake

Selecting text in a body offered one flat "Hand off…" list of every App's Intakes. It could not do the two things a page of writing needs most: link a name to the Person or Place it means, or make that Person or Place when it does not exist yet. User-defined types could not take part at all, because an Intake needs code and they have none.

Selecting text now opens the **Selection menu**, by click or `Ctrl+.`, filtered by typing. **Link** comes first: to the Document the text already names, or to one searched for. Then come the **Modules** in Core's order, with the one the user is in first and user-defined types homed nowhere under **Other** at the end. Each Module group holds its user-defined types and its Apps' Intakes. The Module the user is in sits right after Link, ahead even of an App in no Module (the Calendar); in no Module, the Calendar leads, as on the capture sheet. The Handoff page's picker reads in the same order. Linking, or making a Document of a Linkable type, turns the selection into a wikilink: `[[Marie Curie|Marie]]` when the words differ from the title, with an optional "add as alias". The origin body is rewritten whether or not it was open for writing. Only Document bodies offer the menu, never form inputs.

A user-defined type is offered only for a short, one-line selection, and is **made at once**: titled by the selection, wrapped in a link, opened in a Peek beside the page (ADR 0085), and undone from a toast rather than confirmed. This quick make is **not an Intake**. ADR 0050's "nothing is written until the dialog saves" protects an App's ownership, and here Core is the owner. Separately, **Core gives every user-defined type a generic Intake**, a form for the title, a Template and the Workspace, so a Handoff from outside Lifeline (the extension, the share sheet) can become a Place. The origin URL goes into the type's url Field, or into the body when there is none. Intake stays "code only" for Apps; this one is Core's. `allIntakes()` stays the Apps' Intakes, as code and in sync: Pantry's App-to-App hand off and the build-time `/intakes.json` read it too. The Handoff page adds Core's generic ones itself, from `typeIntakesOf(types)`. The extension cannot name a user-defined type, since its list of Intakes is fixed at build time, so it sends none and the page asks which to use.

## Considered options

- **Make quick make an Intake and relax ADR 0050 to allow "made at once, undone"**: rejected. Every App's Intake would then be free to skip its review.
- **A dialog (title + Template) for quick make too**: rejected. Naming a person mid-sentence should cost one click. The Peek that opens afterwards is where to add more.
- **Last-used ordering**: rejected. A menu that reorders itself defeats muscle memory, as on the capture sheet.
