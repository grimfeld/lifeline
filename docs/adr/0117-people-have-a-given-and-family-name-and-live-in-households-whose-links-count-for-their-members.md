---
status: accepted
amends: ADR 0113 (in part — a Person gains a Given and a Family name, and People gain Households)
---

# People have a Given and Family name, and live in Households whose links count for their members

Nearly every Person ended up with their given name typed as an alias, and "dinner at the Smiths'" had no single thing to link to. So a Person gains two optional Fields, **Given name** and **Family name**, and the People Module gains a Linkable type, the **Household**: the People who live together, with members the user chooses.

- The **title stays free** ("Mum", "Dr Okafor"). The two names make up the title when a Person is added, until a title is typed, and never after that: neither rewrites the other.
- The **Given name is a derived alias**. It resolves `[[Anne]]`, shows in the completer and raises Unlinked mentions like a typed alias, but is never copied into Aliases, so correcting it corrects the name.
- **Membership is chosen, never matched.** A Family name only *suggests* joining a Household whose members share it. A membership carries optional **since** and **until** days. Moving out sets until and never removes the member. A Person may belong to several Households. Members are People visible in the Household's own Workspace.
- **A link to a Household counts for its members.** For whoever was a member on the linking Day's or Event's date, it stands on their Timeline ("via the Smiths") and counts toward their Seen and Mentioned (ADR 0112). This is derived from the links and never stored.
- **People fields hold People, never a Household.** Picking a Household in an Event's With adds its current members, each removable, because With records who was actually there.
- A Household has a title, aliases, members and a body, and nothing else. The home stays each member's Address, so Pins, "former" and ADR 0114's agent ban stay as they are. An agent reads a Household's name and members.
- The given names already typed as aliases are tidied once, on request: a review list proposes filling the names from the title and dropping the duplicated alias.

## Considered options

- **Group by Family name.** Rejected: a spouse who kept their name drops out, a married sister drops out, and two unrelated Smiths merge. A name names; it does not say who lives together.
- **Group by kin** (everyone related, built from Ties). Rejected: "at the Smiths'" names a home, and Paul's mother in another town was not at the table. Ties already describe kin.
- **A title built from the two names.** Rejected: it breaks "Mum" and People known by one name.
- **Copy the Given name into Aliases.** Rejected: two copies drift apart when one is corrected.
- **Let With hold a Household.** Rejected: Seen should count who was there, and a Household is who lives there.
- **Count a Household link for its current members only.** Rejected: once Tom moves out, the dinners he attended would stop counting for him, and later dinners would count him as seen. Hence since/until days.
