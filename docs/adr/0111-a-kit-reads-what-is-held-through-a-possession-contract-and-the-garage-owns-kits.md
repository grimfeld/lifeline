---
status: accepted
---

# A Kit reads what is held through a Possession Contract, and the Garage owns Kits


A **Kit** lists what a situation calls for: a survival bag, a camping weekend, a hospital bag. Its lines are things owned by several Apps: medicine from Supplies, a jacket from Wardrobe, a knife from the Garage, tinned food from Pantry. A Kit is only useful if it can say what is **missing**, and that needs to know, for each line, whether the thing is held. No App imports another (ADR 0001, 0100).

**Possession is a new Core Contract.** A Document type that declares it answers one question about each of its Documents: is it held, and how much. Supplies and Pantry answer from their quantity. Wardrobe and the Garage answer from Acquisition: Owned is held, Wanted and Gone are not. Library and Arcade may declare it later. A Possession type never learns which Kits name it.

**A Kit line is a Link to a Possession Document, or plain text.** A plain-text line is something not recorded anywhere yet ("whistle"), so it is always missing, and it can be turned into a Wanted item (or a Need, for a consumable) from the Kit. A line is covered when its Document is held. What is missing is read from the Kit and never stored.

**The Garage owns the Kit type.** Most of a Kit's lines are equipment, and packing a bag is done where the equipment lives. The App reaches every other App's Documents only through the Contract.

## Considered options

- **Kits that link by plain wikilinks, with no Contract.** Rejected. A Kit could then not tell an owned thing from a wanted one, and "what is missing" would be the user's job again.
- **A Kit App of its own.** Rejected. It would be an App of one type and no family, and nobody opens Kits without thinking of their gear.
- **Letting the Garage import Supplies, Wardrobe and Pantry.** Rejected. It is the kind of exception ADR 0100 refuses, and it would leave Library and Arcade unable to join.

## Consequences

- Core gains the Possession Contract, and every belongings App declares it on the types a Kit may name.
- A deleted Possession Document leaves its Kit lines as broken Links, which read as missing.
