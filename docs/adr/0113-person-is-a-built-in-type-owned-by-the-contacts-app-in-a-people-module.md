---
status: accepted
amends: ADR 0069 (in part — Person is a built-in type, no longer the user-defined example)
---

# Person is a built-in type owned by the Contacts App, in a People Module

Until now, the people I know were meant to be a user-defined type homed in the Journal: ADR 0069's "my user-defined Person `Ursula Le Guin`", the Selection menu's "Journal: Person, Place". A user-defined type gets links, aliases, backlinks, the graph and a Base, and nothing that needs code. What people need is code: a birthday that stands on the calendar every year with an age on it, addresses on the map, a phone number that calls, ties read from both ends, and Reports about when I last saw someone.

So **Person is a built-in type**, owned by a new hand-written App, **Contacts**, and that App makes up a new Module, **People**, placed right after the Journal. A Person is Linkable, with aliases and a body, and holds:

- **Occasions**: a label and a day, yearly or once, each an all-day marker on the time Surfaces (Timed). Birthday is the one label the App understands: it gives an age.
- **Addresses**: labelled, coordinates found on save, each a Pin (Locatable through the App's code, not a Field). Marked former, never removed.
- **Contact details**: labelled phones, emails and handles, acted on by a click. Marked former, never removed.
- **Ties** to other People, entered once with a label for each end and shown on both pages; and a **Relationship**, what the Person is to me.

Only people in my life are People. An Author (Library) or Artist (Museum) I have never met stays that App's home type. One I come to know is **turned into a Person** wearing the Role, so links, aliases and body carry over, as the Library already merges two Authors.

## Considered options

- **Keep Person user-defined in the Journal, and grow Core** (yearly date Fields, field Reports, a call action on text). Rejected: every piece is person-shaped behaviour that Core, which owns no type, would carry for one type. ADR 0078 already declined a Known birthday field for want of behaviour behind it.
- **Home the App in the Journal Module.** Rejected: Modules are what a Workspace takes, and a Work Workspace that wants colleagues should not have to take the Journal. A Person's page is mostly structured, not the Journal's long markdown writing.
- **Every human is a Person** (Authors and Artists become People wearing Roles). Rejected: People's Reports, "not seen in 90 days" first, mean nothing for a novelist I have never met.
- **Important dates as their own Documents** (an Anniversary linking two People). Rejected: heavy for the common case, a birthday. A date two people share is held by each.

## Consequences

- `people` joins Core's Module list after `journal`; Workspaces may take it.
- ADR 0069's decision stands; only its example changes. A Person wears the Author Role exactly as the user-defined Person was meant to.
- An account that already made a user-defined type for people keeps it: a Document never loses its type (CONTEXT.md "Document type"). Moving its Documents into Person is a later, explicit step.
- Seen and Mentioned Reports (ADR 0112) are People's first stats; the Upcoming and group-by-Relationship kinds follow.
