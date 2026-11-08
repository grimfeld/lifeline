---
status: accepted
amends: ADR 0105 (in part — the Private folder is no longer the only thing agents cannot see)
---

# Agents never read or write a Person's Addresses or Contact details

Until now an agent (through the MCP server, ADR 0062) saw every Document except those in the Private folder, and saw each one whole (ADR 0105). People (ADR 0113) hold the most exposed data in Lifeline: where someone lives and how to reach them, data about people who never agreed to be in it. Hiding all of a Person from agents would lose what agents are good for there ("whose birthday is this week?", "what should I get Anne?"), and the Private folder is all or nothing.

So **an agent sees a Person without their Addresses and Contact details**, and can change neither:

- **Never read.** Every MCP answer that carries a Person (search, get, agenda, the Contacts App's own tools) leaves the Addresses and Contact details out, current and former alike. A Person's Pins are not offered to agents either.
- **Never written.** No MCP tool adds, edits or marks former an Address or a Contact detail. A write the agent could not read back could not be checked for duplicates, and an injected instruction could quietly swap a number for someone else's. The user types those in Lifeline.
- **Everything else crosses.** Name, aliases, Relationship, Ties, Occasions, Tags, the body and the Reports. Upcoming Occasions feed the agenda.
- **The body is the user's.** A street typed into a Person's body is read like any body. Lifeline does not look for addresses in prose (ADR 0091: nothing is guessed). The Guide says so, and the Private folder still hides a whole Person.

## Considered options

- **People like any Document; the Private folder for the sensitive ones.** Rejected: one gate for the whole Person makes every birthday question cost the user their friends' addresses.
- **People agent-blind by default, with a per-Person switch.** Rejected: a second, per-Document privacy mechanism beside the Private folder, and most questions an agent is asked about people need no address.
- **Write-only for agents** (they may add a number they cannot read). Rejected for the reasons above.
- **Scan bodies for addresses and phone numbers.** Rejected: a guess at what is private, wrong both ways.

## Consequences

- The gate lives where ADR 0105's does, in the MCP server's handlers, as a rule about the Person type's own Fields, not a flag a user sets.
- A Field the user adds to Person is an ordinary Field and crosses. Only the Contacts App's Addresses and Contact details are held back.
- The Guide's People page and its agents section say exactly what an agent sees.
- The walled keys are declared on the type (`agentWalled`). A write to a Document is checked against its own type's wall, so a type of the user's with its own `addresses` Field is written like any other. A Command's arguments and a Macro step's name no type, so they are checked against every type's wall: no Command may take an argument called `addresses` or `contactDetails`.
- Occasions are part of the Person that the App keeps, declared like the walled parts so that no Field of the user's can take the key. That also hides them from the Fields an agent reads. They reach agents through the Person's `describe`, `people_upcoming` and the agenda instead.
