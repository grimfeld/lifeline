---
status: accepted
amends: ADR 0011 (in part — a type may be Locatable at the Document it links to, and a several-place type names its main place)
---

# A Document may stand on the map at the Document it links to, so an Event is drawn where it is At

An Event's **At** is one Place or one Person, meaning their home (ADR 0128), and an Event At either stands on the map where it happens. But an Event has no coordinates of its own. Its place is the Place's, which Atlas holds, or the Person's current Address, which Contacts holds behind the agent wall (ADR 0114). The Calendar may import neither App (ADR 0100), and it must read no address. The Locatable Contract (ADR 0011) only drew a Document from its own fields.

So a `DocumentTypeDef` may declare **`locatableVia`**: the key of a Link Field naming the Document it stands at. The Calendar's Event declares `locatableVia: "at"`.

- Core's `pinsOf` draws such a Document at the **main place** of the Document it links to: the one Pin of a type Locatable by one place, or, for a type with several (`locatablePins`), the Pin it marks **`main: true`**. The Pin keeps the linking Document's own key, title, App colour and Tags; its subtitle is its singular and its `linkable.subtitle` ("Event · Tue 10 Nov").
- The target is looked up among every Document `pinsOf` is given, whatever Apps the map shows. A target with no place (a closed or unlocated Place), with no Pin marked main, deleted, or of a type that is itself `locatableVia`, gives no Pin, so the Event is off the map.
- Contacts marks as main the current Address labelled **Home**, else the first current Address. When that Address has no coordinates, none is main: the Event is off the map rather than at another of the Person's homes.
- A map's **Open** on such a Pin peeks the Document (`openPin`), since its place is another's and its href is no page of its own.
- Pins stay a UI derivation. No MCP tool reads them, so an Event At a Person is never located for an agent; the agent-wall tests say so.

## Considered options

- **The Calendar copies the coordinates onto the Event at save.** Rejected: it would read a Person's Address in the Calendar, keep a second copy of where someone lives, and go stale when the Place moves or closes.
- **A Core hook on the target type ("where does a Document stand that links to me?").** Rejected: the target would need to know which of its linkers to draw. One Field key on the linking type, and one flag on a Pin, say it all.
- **Draw the Event at every Pin of a Person.** Rejected: an Event happens in one spot, and a Person's work address is not where dinner at Marc's is.

## Consequences

- An Event At a Place or a Person shows on the World map, the Map Surface and the Map card, with an Events chip.
- `pinsOf` indexes the Documents it is given by id once per call, when a `locatableVia` type is among them.
