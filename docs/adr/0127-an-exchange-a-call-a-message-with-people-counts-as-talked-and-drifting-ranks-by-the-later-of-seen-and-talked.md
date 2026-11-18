---
status: accepted
amends: ADR 0112 (in part — Exchanges count as a third family, Talked, and Drifting ranks by the later of Seen and Talked)
---

# An Exchange (a call, a message) with People counts as Talked, and Drifting ranks by the later of Seen and Talked

ADR 0112 made **Seen** count Events that link to a Person, and said "a meeting worth counting is an Event, or worth one". That holds for meeting someone. It fails for the grandmother I call every Sunday and see twice a year: she drifts, because a call is not an Event, and logging it as one fills the Calendar, the Schedule and Today with five-minute calls and "she texted me". And what she told me on the phone has no dated place to live, so next Sunday I have forgotten it.

So the Contacts App gains a built-in type, the **Exchange**: a call, video call, message or letter with one or more People, on a day (never a time, never a day still to come), with an optional body for what was said. And Reports gain a third family beside Mentioned and Seen:

- **Talked** counts **Exchanges** that link a Document through their **With** (their People field), once per day, however many Exchanges that day. A link to a Household counts for its members on that day (ADR 0117). Wikilinks in an Exchange's body make Backlinks and nothing more: grandma telling me about `[[Lucie]]` is not talking to Lucie.
- Its kinds mirror Seen's: **Not talked in N days**, **Top talked**, **Last talked**, **Talked count**, a 12-month heatmap. A Person and a Household start with Last seen, Last talked and Last mentioned.

The three families are still never added together as counts. **Drifting** alone reads two of them, and only as dates: it ranks by when I was last **in touch**, the later of last Seen and last Talked, over a fixed 90 days. Its switch offers **Not in touch** (the default, replacing Not seen) and **Not mentioned**.

## Considered options

- **Log a call as an Event, as ADR 0112 stands.** Rejected: an Event is a moment on the time Surfaces; a call logged after the fact, or a message, is not something to plan the day around, and it would bury the Events that are.
- **Count Exchanges as Seen.** Rejected: "last seen" would stop meaning seen, and the Person page could not tell a visit from a text.
- **A "last contacted" Field on the Person.** Rejected for ADR 0112's reason: a Report is derived, never logged, and a Field keeps no history and no place for what was said.
- **Drifting on Seen alone, with Talked beside it.** Rejected: the person this exists for, someone I keep up with only by phone, would still drift.

## Consequences

- An Exchange is not Linkable: its title is derived ("Call · Grandma") and `[[…]]` never targets one.
- An Exchange stays off the Calendar, the Schedule and Today; it reports one line to the Daylog ("Called Grandma").
- A Person's page shows a **Last time** block: the newest Exchange or Event that reaches them and carries text.
- An agent reads and writes Exchanges, bodies included; ADR 0114 still walls only Addresses and Contact details.
