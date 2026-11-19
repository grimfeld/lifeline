---
status: accepted
amends: ADR 0113 (in part — a Tie may carry a kind beside its two words, and kinded Ties yield suggested Ties)
---

# A Tie may carry a kind, and kinded Ties yield suggested Ties

ADR 0113 gave each Tie two words, one per end, in the user's own words and "never a fixed family vocabulary". The words are right for what is shown: "mum", "godmother", "ex". But Lifeline cannot read them, so it can neither save the typing (every pair of People needs two words by hand) nor see what follows from them: Tom and Lily are both Paul's children, so they are brother and sister, and Paul's wife Alice is their mother.

So a Tie may carry a **kind** beside its words: parent ↔ child, sibling, partner, grandparent ↔ grandchild, aunt/uncle ↔ niece/nephew, cousin, read from one end to the other. The **kind is the meaning; the words are the display.**

- The Tie dialog offers **presets** (daughter, son, child, … cousin): one tap fills both words and sets the kind. The other end's word is the kind's inverse, gendered by a **gender reading**: a Person counts as female or male when the preset words they carry in their own kinded Ties are all of one gender, and neutral otherwise. There is no gender field: reading what I already wrote beats asking anyone's gender.
- The words stay editable, and editing them keeps the kind ("mum" on a parent Tie is still a parent Tie). A Tie with free words only ("godmother") has no kind, exactly as before.
- **Existing Ties are read, never rewritten:** a Tie without a kind whose two words are a consistent preset pair (any case, trimmed) is read as that kind. Nothing is migrated.
- **Suggested Ties:** from kinded Ties, each Person's Ties card offers the Ties that follow, one step at a time (shared parent → siblings; parent's parent → grandparent; parent's sibling → aunt or uncle; parent's sibling's child → cousin; sibling's parent → parent; parent's partner → parent). They are added only on request, like Unlinked mentions, never silently; a dismissal is final for that pair and kind. A pair already tied in any way is never suggested. Chains build as accepted suggestions produce new ones.
- Preset words are English, like the UI. Claude reads Ties as words only, as before.

## Considered options

- **Keep words only, and guess meaning from them each time.** Rejected: free words carry no promise ("mother"/"godson" is no pair), and deductions from guesses would be wrong in ways the user cannot see or correct.
- **A fixed family vocabulary in place of the words.** Rejected for ADR 0113's reason: the words are the user's own ("mum", "ex"), and most of life's ties have no preset.
- **A gender field on Person.** Rejected: asking it is intrusive and it would serve only wording; the user's own words already say it where it matters.
- **Create the Ties that follow automatically.** Rejected: a step-parent or an estranged sibling is real, and a silent write is hard to notice and undo. Suggest, as Unlinked mentions do.
- **Step-, half- and in-law kinds.** Left out for now: free words still say them.

## Consequences

- `contacts_tie` gains an optional `kind`, read from end `a` to end `b`. Its words stay, and are what is shown.
- A Person gains a hidden list of dismissed suggestions, written on both People of the pair, so it moves with them between Workspaces and needs no cleanup when one is deleted.
- Suggestions are derived from the Ties and People already loaded, never stored.
