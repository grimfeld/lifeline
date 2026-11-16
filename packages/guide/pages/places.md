# Places

The places you go: restaurants, cafés, bars, museums, shops, parks. Each one is a **Place** you can
link to from anywhere, with a page of its own. Places sit beside People in [World](world.md).

## Atlas

What you keep here: Places, each with a name, the other names you call it (aliases), a **Kind**,
an **address**, Tags, the marks **To try** and **Closed**, and a page of your own words about it: what you ordered, what you thought, who told you
about it. There is no rating: what you think stays in your own words.

- **Add place** — a name is all it takes; pick a Kind and an address too if you like, or press
  **Here** for the places around you. Where: the
  Places screen, the Capture sheet, the palette (Ctrl+K).
- **Go to Places** — opens the Places screen. Where: the palette.
- **Places** — every Place in the current Workspace, A to Z, or by **Last visit** (**Sort**):
  the Place you went to most recently first, the ones you have never been to last. **All**, **To try** and **Closed**
  switch between the lists: All leaves the closed Places out, To try lists the open Places marked
  To try, Closed lists the closed ones. **Kind** narrows any of them to one Kind, so To try and
  Restaurant together are the restaurants you want to go to. On a phone these and Sort are under **Filters**. Click a Place to open its page. With no Place yet, the screen
  offers **Add place**.
- **Kinds** — on the Places screen: rename a Kind or add your own (bakery, climbing gym…). A Kind
  is never removed, so no Place loses its own, and a renamed one keeps every Place that had it.
  Bases and the Peek show the new names too.

### Names are unique

Each Place has a name no other Place has, in whatever folder it is filed, so `[[Chez Janou]]`
always lands on one Place. Adding a Place with a name a Place already has, or renaming one to it
(on its page, in the Vault, in a Base or the file tree), is refused, whatever its capitals or
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
and work offline. A Place with no address (unless placed with **Just here**), or one found nowhere, has no Pin.

### Here

Standing in the place you want to add? Press **Here** in **Add place**. Lifeline reads where your
device is, once, and lists the places around you, each with its address: pick the one you're in
and it fills the name, the address and the spot on the map. For a spot no lookup knows (a
viewpoint, a market stall), type its name and press **Just here**: where you stand becomes its
spot on the map, with no address.

Your position is read only when you press Here, never in the background. It is sent only to the
lookup that finds the places around you, and never kept or logged: only the Place you add keeps
its spot. The first time, the browser asks whether Lifeline may know where you are. If you refuse,
or no position can be had, Here says so: type the name instead. Where the browser offers no
location at all, there is no Here.

### To try

Tick **To try** on a Place's page or in its Peek to keep it on your list of places to go. It drops
off by itself once you have been: when an Event **At** the Place, or one whose notes link to it,
has happened since you marked it, meaning its last day is on or after the day you ticked it, and
before today. The day counts however you mark it: on its page, in its Peek, in a Base or by Claude. An Event from before you ticked it doesn't count, so a Place you have been to can go
back on the list ("I want to go again"). An Event still to come, today's included,
leaves the mark, so booking a table is not counted as going. A Day that only mentions the Place
leaves it too. The mark is checked when an Event is saved and when you open the Place, so a dinner
that passed since is caught then. Untick it yourself whenever you like.

### Closed

Tick **Closed** when a Place shuts for good. It leaves the map and the All and To try lists, and
shows under **Closed**; its page says so. It keeps everything else: its links, backlinks, notes and
the Events held there. Untick **Closed** to reopen it. The Events At it leave the map with it.

### A Place's page

Its name, which you rename right there (every `[[link]]` to the old name follows), and under it
when you last went: "Last visited 10 Nov · 1 visit", or "Not visited yet". Then its Kind, its
**Address**, aliases and Tags, its spot on a small map (expand it to open the [Map](map.md)
there) and its **Reports**; **Notes**, the page of your own words; its **Timeline**; then
**Backlinks**, every Day, note and
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
Each Event **At** the Place stands at its pin too, in the Calendar's colour, with its title and day.
On World's map it follows its Place through **Kind** and **To try**: To try shows the Events at the
Places you want to try, and no others.

### Visited and its Reports

**Visited** is how often you go, counted from the Events that link to the Place: an Event **At**
it, or one with `[[Chez Janou]]` in its notes. It counts once per day, however many Events, each
day of a two-day Event, and only Events that have happened: next week's booking isn't a visit
yet. An Event that ends at midnight counts only the day it started. A Day that links to the Place
is **Mentioned** instead, shown beside Visited and never added to it.

- **Reports** — on the Place's page: **Last visited** (the day and how long ago), **Visits** (this
  year and in all) and **Last mentioned** (the last Day that links to it).
- **Top visited** — the Places on the most days of Events, shown on each [Journal](journal.md)
  period as **Places · Top visited**, beside **People · Top seen**.
- **Report Cards** — any of them can be placed on a Screen as a Report Card: pick Places for
  **Top visited** or **Not visited lately**, or one Place for **Last visited**, **Visits** or a
  **Visited heatmap**. See [Screens](screens.md).

### Timeline

On a Place's page, the Events planned there, today's included, sit above a **Today** line by
month, the nearest just above it; an Event still under way stays there until its End day has
passed. Below it, everything else that links to the Place by month, newest first: Events At it
("via At"), and the Days and notes that name it ("mentioned"). Click one to peek at it.

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
included. Its searches show each Place's Kind and address, and so does `agenda` for an Event At a
Place.

- "Save that ramen place Anne told me about" — `places_add`, with a name and, if you like, a Kind,
  an address (looked up once to put it on the map), aliases, Tags and To try ("I want to try it"). A name a Place already has is refused, and Claude is told which Place it is; so is renaming a Place to one (`update_document`). A Place in the Private folder is never named: Claude only learns that the name is taken.
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
