---
status: accepted
---

# A query that is nothing but a date opens it in the Journal


Going back years in the Journal had no fast way in: the sidebar calendar paged one month at a time, and the palette could only open today, this week and this month. A palette Command received `navigate` and nothing else, never what the user had typed, so "go to a date" could only be a Command that opened a dialog with a field in it: two steps to do what the search box was already holding.

One Command reads the palette's query bare: when the whole query is a date or a Journal period, it offers that period in the Journal. Its row sits above every other row and shows what it understood. It takes an ISO date (`2023-03-14`, the Day) and the keys the Journal already titles its periods with: `2023-W11`, `2023-03`, `2023-Q1`, `2023`. Future dates are fine: the page opens, and nothing is made. Nothing runs until Enter, and the search results still show beneath it.

This is the one exception to ADR 0091, where every other inline argument is marked (`!journal /2023-03-14`) and bare words are never read as dates. That rule guards titles from losing words to a guess ("Watch The Day After Tomorrow" getting a due date); a line that is nothing but a date has no title words to lose.

A plain "Go to date…" Command stays in the list, so the feature can be found by name. Picking it leaves the palette open with the cursor in the query.

## Considered options

- **A dialog Command ("Go to date…" opens a field)**: fits the existing `dialog` mechanism with no palette change. Rejected: it is two steps, and every later Command that wants a typed argument would build its own dialog for what the query already holds.
- **Natural language ("last tuesday", "a year ago")**: left out. The period keys are how the Journal names things, and they need no parser. Words are ADR 0091's marked dates (`/last tue`).
- **Only the marked form (`!journal /2023-03-14`)**: rejected for this one case. Typing a date and landing on that day is the point of going back years, and a whole-line date steals nothing from a title.

## Consequences

- An inline Command outranks Documents whose titles match the query: typing `2023` offers the Year before a Document called "2023".
- The Command entry in CONTEXT.md names this as the one exception to marked arguments. No other Command reads the bare query; a new one would need its own decision.
