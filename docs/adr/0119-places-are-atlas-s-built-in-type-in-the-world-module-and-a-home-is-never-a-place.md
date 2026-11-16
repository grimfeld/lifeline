---
status: accepted
amends: ADR 0113 (in part — the People Module becomes World, and a place is no longer a user-defined type of the Journal), ADR 0112 (in part — an Event's At on a Person never counts as Seen), ADR 0114 (in part — a hidden Document is never named to an agent, in any field or any type)
---

# Places are Atlas's built-in type in the World Module, and a home is never a Place

The glossary called a place a user-defined type of the Journal ("Person and place are user-defined types"). ADR 0113 took Person out of that list; place stayed. A user-defined type gets links, aliases, backlinks, the graph and a Base, and nothing that needs code. What places need is code: an address found from a name, the position I stand at, a count of my visits, a "to try" mark that clears itself, and an Event that happens *at* one.

So **Place is a built-in type**, owned by a new hand-written App, **Atlas**, and the People Module becomes **World**, holding Contacts and Atlas side by side.

- **Place** is Linkable, with aliases and an optional body, and has a **Kind** (restaurant, café, bar, museum, gallery, shop, mall, park, venue, other; the user may rename and add options), **To try**, **Closed**, and an address (postal text and coordinates, found on pick or save, never when a map is drawn). Its id is `atlas_place`, named `PLACE_TYPE` by Core so other Apps reach it without importing Atlas (ADR 0100). Titles are unique among Places; each branch of a chain is its own Place. There is no rating: what I think stays in my own words.
- **World** is the Module `people` retitled; its id is kept, so every Workspace that took People takes World with nothing to redo. Its home is one map of every Pin from both Apps: Places and People's current Addresses, told apart by each App's colour. A closed Place has no Pin.
- **An Event's At** is one Place or one Person (their home). At on a Person never counts as seeing them: only **With** and note wikilinks do. At counts toward a Place's **Visited**, the Seen family of Reports (ADR 0112) under its place name; a Day that links is Mentioned, never added to Visited.
- **To try** clears when an Event whose last day is before today, and on or after the day the mark was set, links to the Place (by At or a wikilink). A future Event leaves it, and so does one from before the mark, so a Place gone to can be marked again. Atlas keeps that day beside the mark (`toTrySince`); a mark made before it was kept clears for any past Event.
- **Here** (on the Place form only) reads the device position once, on tap, to offer nearby places; the position is never stored, only the chosen Place's coordinates.
- **A home is never a Place.** An Address stays on its Person, behind the agent wall (ADR 0114). At on a Person reaches an agent as the Person alone, never their Address. Places have no wall: an agent may read and add them, address included.

## Considered options

- **Keep place a user-defined type.** Rejected: it cannot find an address, read a position, count visits or be an Event's At.
- **A Place for each home, so At is always a Place.** Rejected: it would copy Addresses out from behind ADR 0114's wall and make a second record of where someone lives.
- **Several Places per Event, nesting (towns, areas), ratings, opening hours.** Rejected for now: several stops are several Events; the rest is data I would have to keep true.
- **A Module of its own for Places.** Rejected: Modules are what a Workspace takes, and a Place is next to a Person in the same life; renaming one Module adds nothing to take.

## Consequences

- `people` keeps its id and is titled **World**; Contacts and Atlas both name it.
- The built-in id is `atlas_place`, not `place`, so a user-defined `place` type, if any account has one, stays the user's own, untouched. Moving its Documents into Place is a later, explicit step.
- The Event type gains `at`, a Link that may target `PLACE_TYPE` or `PERSON_TYPE`.
- ADR 0113's "People Module" reads World from here on; the rest of it stands.
- **A hidden Document is never named to an agent, in any field or any type**, widening ADR 0114's wall past a Person's Addresses. A link Field of any type whose target is hidden from agents (in the Private folder, or internal) reaches an agent blanked: get_document leaves it out and search does not match on it. A Command or Macro run by an agent resolves its link arguments only among the Documents an agent sees (`InvokeContext.sees`), so a hidden one's id, title or alias reads as no Document at all, an ambiguous name lists none, and a refused title (below) names no hidden Document that has it.
- A Place's title is unique in every folder, Private included, so a title refused to an agent tells it that some Place has that name, though not which (ADR 0114). That yes or no on a guessed name is an accepted cost: two Places with one name would break every `[[link]]` to them, and a Place in Private is rare.
