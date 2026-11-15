---
status: accepted
---

# A type keeps its own Documents true after another type's Document is saved

A Place's **To try** clears once an Event that links to it has happened (ADR 0119). Atlas writes the mark, so the To try list and the World map filter it as a plain field. But the Event is Calendar's, and Calendar may not import Atlas (ADR 0100). Calendar is not the only writer either: the Event dialog, its Peek, a reschedule on the Schedule, a Base row and an agent's `calendar_add_event` or `update_document` all save Events. Nothing told Atlas that one had changed.

So a `DocumentTypeDef` may declare **`afterSaveOf: { of, run }`**. After `putDocument` writes a Document whose type is in `of` (and so after `patchDocument`, which goes through it), Core calls `run` with the Document as written. The owning App works out what it means for its own Documents and writes them.

- Core knows neither meaning: it only matches the saved Document's type against `of`. The App reads the rest (links, dates) through Core, as it would anywhere.
- `run` writes only its own type's Documents and is **idempotent**: the same save told twice changes nothing. A hook that writes back a type in its own `of` would loop, so none may.
- A failure is logged and swallowed. The save it follows has already happened, and a broken follower must not make it look as if it had not.
- It runs wherever `putDocument` runs: in the app and in the MCP server alike. It does not run for rows a sync pulls in, which were followed on the device that wrote them.

Atlas declares `afterSaveOf: { of: [EVENT_TYPE] }`. Because a To try Place may also pass its mark while nothing is saved (a dinner booked last week is in the past today), Atlas applies the same rule when the Place is opened.

## Considered options

- **Derive To try at read time** (a Place is "To try" while no past Event links to it). Rejected: ADR 0119 has Atlas write it, so the list, the map and a Base filter one field, and an agent reads what the user sees.
- **Calendar calls Core after each save** (`touchLinked(event)`). Rejected: each of the Event's writers would have to remember, and a Base edit or an agent's `update_document` would not.
- **A hook on the linked type, called for every target a saved Document links to.** Rejected for now: it needs the saved Document's wikilinks resolved on every write of every type, a link index build per keystroke of a Day. The App that cares can do it, only for the types it names.

## Consequences

- `putDocument` reads the type registry on every write, and calls a hook only for the types some App named.
- Atlas's hook returns at once unless the Event has happened and some Place is To try, so most Event saves cost nothing more.
