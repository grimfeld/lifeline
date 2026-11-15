# Places

The places you go: restaurants, cafés, bars, museums, shops, parks. Each one is a **Place** you can
link to from anywhere, with a page of its own. Places sit beside People in [World](world.md).

## Atlas

What you keep here: Places, each with a name, the other names you call it (aliases), a **Kind**,
an **address**, Tags, the marks **To try** and **Closed**, and a page of your own words about it: what you ordered, what you thought, who told you
about it. There is no rating: what you think stays in your own words.

- **Add place** — a name is all it takes; pick a Kind and an address too if you like. Where: the
  Places screen, the Capture sheet, the palette (Ctrl+K).
- **Go to Places** — opens the Places screen. Where: the palette.
- **Places** — every Place in the current Workspace, A to Z. **All**, **To try** and **Closed**
  switch between the lists: All leaves the closed Places out, To try lists the open Places marked
  To try, Closed lists the closed ones. **Kind** narrows any of them to one Kind, so To try and
  Restaurant together are the restaurants you want to go to. On a phone both are under **Filters**. Click a Place to open its page. With no Place yet, the screen
  offers **Add place**.
- **Kinds** — on the Places screen: rename a Kind or add your own (bakery, climbing gym…). A Kind
  is never removed, so no Place loses its own, and a renamed one keeps every Place that had it.
  Bases and the Peek show the new names too.

### Names are unique

Each Place has a name no other Place has, so `[[Chez Janou]]` always lands on one Place. Adding a
Place with a name a Place already has, or renaming one to it, is refused, whatever its capitals or
accents, and the Place there is offered instead: **Open** it rather than make a second. Two branches
of a chain are two Places with two names: "Lidl Jean Jaurès" and "Lidl Prado".

### Finding its address

Type a Place's name, or its address, in **Add place** and real places that match are offered as
you type, each with its address. Pick one and it fills the name, the address and the spot on the
map in one go. When nothing matches (a small or new place), type the address yourself and press
**Locate** to find it; if several places answer, choose one. Or just **Add**: a typed address is
looked up once when the Place is saved. One found nowhere is kept all the same, off the map, and
the form says so: "Not on the map yet".

The spot is found only then, when you pick or save, never when a map is drawn, so maps stay fast
and work offline. A Place with no address, or one found nowhere, has no Pin.

### To try

Tick **To try** on a Place's page or in its Peek to keep it on your list of places to go. It drops
off by itself once you have been: when an Event **At** the Place, or one whose notes link to it,
has happened, meaning its last day is before today. An Event still to come, today's included,
leaves the mark, so booking a table is not counted as going. A Day that only mentions the Place
leaves it too. The mark is checked when an Event is saved and when you open the Place, so a dinner
that passed since is caught then. Untick it yourself whenever you like.

### Closed

Tick **Closed** when a Place shuts for good. It leaves the map and the All and To try lists, and
shows under **Closed**; its page says so. It keeps everything else: its links, backlinks, notes and
the Events held there. Untick **Closed** to reopen it.

### A Place's page

Its name, which you rename right there (every `[[link]]` to the old name follows), its Kind, its
**Address**, aliases and Tags, and its spot on a small map (expand it to open the
[Map](map.md) there); **Notes**, the page of your own words; then **Backlinks**, every Day, note and
Event that links to it (an Event **At** it says "via At"), and **Unlinked mentions**, the prose that names it without a link, ready
to link. **To try** and **Closed** sit under its Kind. A Place's Peek edits its Kind, To try and
Closed, address, aliases and Tags, and **Open** leads to its page.

To change the address, type a new one and press **Save address**, which looks it up again, or pick
a match, which is saved at once with its spot. An address that is not on the map yet offers
**Locate**. Clearing the address takes the Place off the map.

### On the map

A Place with an address found stands on [World](world.md)'s map and on the [Map](map.md), as a pin
in Atlas's colour, apart from People's homes. A closed Place has no pin. On World's map, **To try**
shows only the Places you want to try, and goes with the Kind: To try and Café are the cafés you
haven't been to yet. People's homes stay on the map either way.

### Linking to a Place

Write `[[Chez Janou]]` in any body, or an alias: `[[Janou]]`. When a Place and something else
share a name, `[[place:Lidl Prado]]` names the Place. The link completer shows each Place as
**Place**, with its Kind ("Place · Restaurant"), so you can tell the Place "Lidl Prado" from a Shop
called "Lidl". Places stand on the [Graph](graph.md) in Atlas's colour.

## Capture

**+** on a phone offers **Add place**, under World, when the Workspace takes World; Ctrl+K offers it
everywhere.

## Ask Claude

Places are open to Claude: it can find and read them, Kind, address, aliases, Tags and notes
included. Its searches show each Place's Kind and address.

- "Save that ramen place Anne told me about" — `places_add`, with a name and, if you like, a Kind,
  an address (looked up once to put it on the map), aliases, Tags and To try ("I want to try it"). A name a Place already has is refused, and Claude is told which Place it is.
- "Which museums have I saved?" — Claude searches your Places and reads them.

## Tips

- A Kind sorts Places broadly; Tags group them finer (`cuisine/japanese`).
- Deleting a Place leaves the links to it unresolved, as with any deleted Document.

## Related

- [World](world.md) — the Module Places belong to, and its map.
- [Map](map.md) — every pin, Places among them.
- [People](people.md) — the people in your life, beside Places in World.
- [Links](links.md) — how `[[links]]`, aliases and backlinks work.
- [Graph](graph.md) — what connects to your Places.
