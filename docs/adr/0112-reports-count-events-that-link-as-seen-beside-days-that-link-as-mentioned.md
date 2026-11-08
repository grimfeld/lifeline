---
status: accepted
amends: ADR 0076 (in part — a Report counts Events that link, as Seen, beside Days that link)
---

# Reports count Events that link as Seen, beside Days that link as Mentioned

ADR 0076 made a Report count **Days that link** to a Document and nothing else, because only a Day *is* a date: a Note or a Thought carries when it was written, not when the thing happened. With People (the Contacts App), the figure a person most wants is not how often Marc came up in the Journal but **when I last saw him**, and how often this year. That already sits in the data: "Dinner with [[Marc]]" is an Event, and an Event happens on a day.

So the catalogue gains a second family, **Seen**, beside the mention family, which keeps its name and meaning:

- **Mentioned** counts Days that link to a Document, once per Day (ADR 0076, unchanged).
- **Seen** counts **Events that link** to a Document, once per day the Event is on, however many Events that day link it. An Event over several days counts on each. An Event in the future counts nowhere until its day has come.

The two are never added together. A Day that mentions Marc and the dinner Event on that Day are two facts, and a Report shows them as two figures.

The Seen kinds mirror the mention ones: **Not seen in N days** and **Top seen** (ranking), **Last seen**, **Seen count** and a 12-month heatmap (per Document). Any Linkable type may pick them, the same way it picks the others; a Person starts with Last seen and Last mentioned.

## Considered options

- **Mentions only, as ADR 0076 stands.** Rejected: seeing someone would count only if it was also written about on that Day, so "last seen" would really be "last written about".
- **Count any Document that links, by when it was written.** Rejected for the reason ADR 0076 gives: written is not happened.
- **Fold Seen into Mentioned as one "came up" count.** Rejected: one evening would count twice, once as the Day and once as the Event, and the reader could not tell meeting someone from thinking about them.
- **A logged "saw them" entry on the Person.** Rejected: a Report is derived and never logged (CONTEXT.md "Report"). A meeting worth counting is an Event, or worth one.

## Consequences

- Only Events count, never markers: an Occasion on Marc's birthday is not seeing him.
- Tasks stay out, even dated ones: a Task is work given a day, not a moment with someone. If a "seen" Task is ever wanted, it becomes an Event.
- A shared Event linking several People counts once for each of them.
