---
status: accepted
---

# A built-in type declares in code what Core cannot guess of it, one hook per need with a user

Places (ADR 0119) asked Core for six things no type had needed: an agent's search should say what and where each hit is; a field in another App (an Event's At) should make one from a name; the user should rename and add a built-in Choice's options; the Seen family should speak in the type's words and skip a link the type names (an Event's At on a Person); and titles should be unique in every folder, not per folder. Core may not import Atlas, and the Apps that use a Place may not either (ADR 0100). So each is a key on `DocumentTypeDef` (or `FieldDef`), declared in code by the owning App, which Core reads without knowing what a Place is.

Each hook has one user today, and exists because a second App would need the same thing, not as a guess at one:

- **`searchFields`** (type): the Field keys `search_documents` gives beside each hit, and `agenda` beside an Event's At, so an agent need not `get_document` every result to see what it found. The agent wall still holds: a walled key is never given (ADR 0114). *User:* Place, `["kind", "address"]` — Places have no wall. A Person gives none, so At on a Person stays its id and title.
- **`createNamed`** (type): how the owning App makes one of its Documents from a name alone, by its own rules, answering the one there is when the name is taken. *User:* Place, for "New place …" in the editor's `AtField`, which imports neither Atlas nor Contacts.
- **`userOptions`** (Field) with **`saveFieldOptions`**: a built-in Choice whose options the user may rename and add to, kept on the type's override record; an option is never removed, so no value a Document holds is orphaned. *User:* a Place's Kind, through Atlas's Kinds dialog. The rest of a built-in's Fields stay its App's (ADR 0019).
- **`seenAs`** (type): the type's words for the Seen family of Reports (ADR 0112): `{ verb, one, many }`. Absent, it is "seen", counted in days. *User:* Place, "visited" / "visit" / "visits".
- **`seenExcept`** (type): the links of the type's Fields that do not count their target as Seen, each a Field key and the type it points at; every other link still counts. Core reads it in the Seen family without naming any App's field. *User:* Event, `[{ field: "at", type: Person }]` — being At Marc's home is not seeing Marc (ADR 0119); At a Place counts as a visit.
- **`uniqueTitles`** (type): titles unique among the type's Documents in every folder, case and accents aside, where others are unique per folder. Core holds it in `putDocument`, so a rename, the Vault's title field, a Base cell and an agent's `update_document` all refuse a taken title with **`TitleTaken`**, which names and carries the Document that has it. *User:* Place ("Lidl Prado" is one spot, wherever it is filed).

## Considered options

- **Atlas does it itself, beside Core.** Rejected: the MCP server, the editor and a Base each write or read Places without Atlas's screens; a rule kept only in Atlas's repo (as titles first were) is skipped by every other path.
- **One general "type behaviour" object.** Rejected: six unrelated needs under one name hide which one a type uses; a key per need is read where it is used.
- **Wait for a second user before adding any.** Rejected for these: each is needed now, by a path that may not import the App.

## Consequences

- A hook with no user is removed, not kept for later: each one names its user here, and a new hook gets an ADR line of its own.
- `putDocument` reads the type's Documents only for a type with `uniqueTitles`, and only when the title is new or changed, so a pair that shares a title from before (a sync, an older build) still saves.
- An agent's refusal names the Place that has the title, with its id, unless that Place is hidden from agents.
