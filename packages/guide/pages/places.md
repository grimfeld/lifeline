# Places

The places you go: restaurants, cafés, bars, museums, shops, parks. Each one is a **Place** you can
link to from anywhere, with a page of its own. Places sit beside People in the same Module.

## Atlas

What you keep here: Places, each with a name, the other names you call it (aliases), a **Kind**,
Tags, and a page of your own words about it: what you ordered, what you thought, who told you
about it. There is no rating: what you think stays in your own words.

- **Add place** — a name is all it takes; pick a Kind too if you like. Where: the Places screen,
  the Capture sheet, the palette (Ctrl+K).
- **Go to Places** — opens the Places screen. Where: the palette.
- **Places** — every Place in the current Workspace, A to Z. **Kind** narrows the list to one Kind;
  on a phone it is under **Filters**. Click a Place to open its page. With no Place yet, the screen
  offers **Add place**.
- **Kinds** — on the Places screen: rename a Kind or add your own (bakery, climbing gym…). A Kind
  is never removed, so no Place loses its own, and a renamed one keeps every Place that had it.
  Bases and the Peek show the new names too.

### Names are unique

Each Place has a name no other Place has, so `[[Chez Janou]]` always lands on one Place. Adding a
Place with a name a Place already has, or renaming one to it, is refused, whatever its capitals or
accents, and the Place there is offered instead: **Open** it rather than make a second. Two branches
of a chain are two Places with two names: "Lidl Jean Jaurès" and "Lidl Prado".

### A Place's page

Its name, which you rename right there (every `[[link]]` to the old name follows), its Kind,
aliases and Tags; **Notes**, the page of your own words; then **Backlinks**, every Day, note and
Event that links to it, and **Unlinked mentions**, the prose that names it without a link, ready
to link. A Place's Peek edits its Kind, aliases and Tags, and **Open** leads to its page.

### Linking to a Place

Write `[[Chez Janou]]` in any body, or an alias: `[[Janou]]`. When a Place and something else
share a name, `[[place:Lidl Prado]]` names the Place. The link completer shows each Place as
**Place**, with its Kind ("Place · Restaurant"), so you can tell the Place "Lidl Prado" from a Shop
called "Lidl". Places stand on the [Graph](graph.md) in Atlas's colour.

## Capture

**+** on a phone offers **Add place** when the Workspace takes this Module; Ctrl+K offers it
everywhere.

## Ask Claude

Places are open to Claude: it can find and read them, Kind, aliases, Tags and notes included.

- "Save that ramen place Anne told me about" — `places_add`, with a name and, if you like, a Kind,
  aliases and Tags. A name a Place already has is refused, and Claude is told which Place it is.
- "Which museums have I saved?" — Claude searches your Places and reads them.

## Tips

- A Kind sorts Places broadly; Tags group them finer (`cuisine/japanese`).
- Deleting a Place leaves the links to it unresolved, as with any deleted Document.

## Related

- [People](people.md) — the people in your life, in the same Module.
- [Links](links.md) — how `[[links]]`, aliases and backlinks work.
- [Graph](graph.md) — what connects to your Places.
