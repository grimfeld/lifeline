# Shopping list: Needs are not Tasks, one Need per thing, fed by Intake

A new **Shopping list** App (House Module) holds **Needs** — anything to buy at the next chance, written in seconds from the phone's capture sheet. A Need is its own Document type rather than a Task tagged `buy`, because its right moment is a place, not a time: it has no day, is never Schedulable, earns no Push, and a pool of errands would pollute the Schedule's Unplaced column. Ticking a Need makes it **Bought** — dated and kept, never deleted — and typing the same title again (case and outer spaces aside) brings the same Need back instead of making a second one, so there is one Need per thing forever and the capture field can offer past Needs with their Aisle and note. Other Apps feed the list only through the Shopping list's **Intake** (ADR 0050): Pantry sends a running-low Provision as a Handoff, and nothing reads another App's data live.

## Considered options

- **Tasks tagged `buy`** — rejected: a Task is work on a day; Needs would sit in the pool forever, be offered Push, and ticking twelve in a shop is not completing twelve pieces of work.
- **A new Need per purchase (copied from the last)** — rejected: the purchase history this would build already exists as Prices' Receipts; here it only multiplies identical "milk"s in suggestions.
- **Deleting a Need when bought** — rejected: loses the one-tap re-add and the undo of a fat-fingered tick.
- **Recurring Needs** — rejected: a staple that keeps running out is Pantry's *running low*; the Shopping list does not keep a second model of stock.
- **Shopping list reading Pantry's running low live** — rejected: couples two Apps and muddies what ticking means (does it restock?). A Handoff keeps each App's ownership whole.
- **A Need linked to a Prices Product or Shop** — rejected for now: Needs are anything (a card, a drill bit), Prices is deliberately unlinked, and the grouping that matters is a loose **Aisle**, not a chain.

## Consequences

- Library and Arcade's old "Shopping list" is renamed the **Wanted list**; the word now belongs to this App.
- A Need is not Linkable: "milk" is a word, not a subject, and would swallow every `[[milk]]`.
- Rename-onto-an-existing-title is refused in the App's own dialog; the generic Base/Vault editors cannot enforce it, so reads tolerate the rare duplicate.
