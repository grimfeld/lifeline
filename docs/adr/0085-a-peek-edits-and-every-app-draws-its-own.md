---
status: accepted
amends: ADR 0057 (the Peek), ADR 0068 (in part — bodies written in the Vault)
---

# A Peek edits, and every App draws its own

The Peek (ADR 0057) opened a Document where the user was, but only to look and run its owner's operations: adding an alias to a Person, coordinates to a Place or a line to a body still meant leaving the page for the Document's Home Module or the Vault. Writing a Day that mentions three people is exactly when those small fixes come up, and leaving the Day for each one breaks the writing.

So **a Peek edits**. Its Fields are edited in place, and its body is written there with the Vault's own `DocumentEditor` (Daylog blocks, Versions, Outtakes included) once the user asks. Until then the body is read, so a Peek opened to look changes nothing. It stays a side panel on the desk and a bottom sheet on the phone, so the page it was opened from stays in view. Following a link inside a Peek replaces what it shows, with a way back; a Peek never opens over another Peek. `Ctrl+Enter` on a wikilink in an editor peeks it.

**Every App draws how its own Documents' Fields are edited in its Peek**, and none leans on Core's generic `FieldsForm`. Guarded fields only change through the owner's operations, and only the owner knows which controls fit its type. Core draws the frame (body, back stack, ways through), the **user's own Fields** beneath the App's part (an App never draws a Field it did not define), and the whole Peek of a user-defined type's Document. Until an App has written its editable Peek, its Documents keep the read-only one: Apps move over one by one.

## Considered options

- **Body read-only in a Peek, "Edit in Vault" only**: rejected. The body is most of what gets fixed while writing elsewhere.
- **A centred dialog**: rejected. It hides the page that prompted the edit.
- **Stacked Peeks**: rejected. Layers pile up and get lost; one Peek with a back stack is enough.
- **Core's `FieldsForm` as the editable Peek for every built-in type until each App writes one**: rejected. It would become the permanent answer, and it treats every type the same way the Bases already do.
