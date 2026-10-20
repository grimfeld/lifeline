---
status: accepted
---

# Inline Commands read the palette's query, and a date opens in the Journal


Going back years in the Journal had no fast way in: the sidebar calendar paged one month at a time, and the palette could only open today, this week and this month. A palette Command received `navigate` and nothing else, never what the user had typed, so "go to a date" could only be a Command that opened a dialog with a field in it: two steps to do what the search box was already holding.

A Command may now be **inline**. It reads the palette's query as its argument and is offered only when the query parses. Its row sits above every other row and shows what it understood. The first one opens a date in the Journal. It takes an ISO date (`2023-03-14`, the Day) and the keys the Journal already titles its periods with: `2023-W11`, `2023-03`, `2023-Q1`, `2023`. Future dates are fine: the page opens, and nothing is made.

A plain "Go to date…" Command stays in the list, so the feature can be found by name. Picking it leaves the palette open with the cursor in the query.

## Considered options

- **A dialog Command ("Go to date…" opens a field)**: fits the existing `dialog` mechanism with no palette change. Rejected: it is two steps, and every later Command that wants a typed argument would build its own dialog for what the query already holds.
- **Natural language ("last tuesday", "a year ago")**: left out for now. The period keys are how the Journal names things, and they need no parser. A later inline Command can widen what parses without changing the mechanism.

## Consequences

- An inline Command outranks Documents whose titles match the query: typing `2023` offers the Year before a Document called "2023".
- The Command entry in CONTEXT.md loses "inline parsing may come later". Inline is now a kind of Command, beside capture and headless.
