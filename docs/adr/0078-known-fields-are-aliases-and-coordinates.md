---
status: accepted
---

# The Known fields are Aliases and Coordinates

Two Fields mean something to Lifeline: an `aliases` list makes `[[links]]` find a Linkable type's Documents by other names, and a user-defined type's first geo Field puts its Documents on the map (Locatable). Until now people got either by happening to type the right key with the right kind, and nothing said that Aliases does nothing on a type that isn't Linkable, or that a second geo Field never reaches the map.

The **Known fields** are exactly two (CONTEXT.md "Known field"):

- **Aliases** — key `aliases`, kind List. Works on any Linkable type, built-in or user-defined.
- **Coordinates** — kind geo, on a user-defined type only. A type has at most one: its first geo Field (its `locatableField`).

A Field is Known only when its key *and* kind match. The Type editor's "+ Field" menu offers, first, the Known fields that work on the type and aren't on it yet; a Known field's row is marked, its key and kind locked, its label free. Because a type has at most one Coordinates field, geo is offered only as that Known field, never among the plain kinds. Picking Aliases on a type that isn't Linkable turns Linkable on; a new type starts with Aliases.

A Document's own keys (`id, type, title, body, tags, folder, createdAt, updatedAt, deleted, workspace`, `roles`, `tallies`) are never Field keys — refused for a new Field in the editor and in the type store.

## Considered options

- **A Field flag ("is aliases")** instead of key and kind — rejected: frontmatter, agents and older types already speak `aliases:`; a flag would be a second name for the same thing.
- **More Known fields** (birthday, cover image) — not now: each needs behaviour behind it first. What a plain kind unlocks (a board for a Choice, a calendar layout for a date) is the kind's doing, not a Known field.
- **Letting the user pick which geo Field is the map one** — out of scope; extra geo Fields on existing types stay as ordinary Fields, the first stays Coordinates.

## Consequences

- An `aliases` Field of another kind is an ordinary Field, with a note that links don't use it.
- Unticking Linkable keeps Aliases and its values; its row says it does nothing until the type is Linkable again.
- A built-in type is never offered Coordinates — built-ins don't become Locatable from data.
