# Links

Documents point at each other with **wikilinks**. Every link is seen from both ends: the page that
links, and the page linked to, which lists it as a **backlink**.

## Wikilinks

- Write `[[Name]]` in any body. As you type, the completer offers matching Documents, with their
  type.
- A name matches by title first, then by alias — ignoring case, accents and extra spaces.
- `[[media:Dune]]` — a type in front picks between two things with the same name.
- `[[Marie Curie|Curie]]` — the link shows "Curie" but points at Marie Curie.
- Once a link has found its Document it stays on it, even if another one later takes the same name.
- Renaming a Document rewrites the links to it.
- A link to a name nothing has yet stays unresolved; click it to create that Document (a Thought,
  unless the page you are on makes something else).
- A **Link** field on a Document (an employer, a Source) counts as a link too.
- Only **Linkable** types can be linked to. A type of your own is Linkable when you tick it.

## The links panel

Open it with the links-panel button on a Document's toolbar. It holds:

- **Links** — what this Document links to.
- **Backlinks** — every Document that links here, with the line that does it (or "via" the field).
- **Unlinked mentions** — Documents that write this one's name or alias as plain text, without a
  link. **Link** one, or **Link all**.
- **Unlinked names** — names of other Documents in this body that could be links. **Link** one,
  or **Link all** (or **Link N unambiguous** when some spots could mean two things).
- Nothing is linked unless you ask; each bulk link offers **Undo**.
- Where two names overlap ("Pour Alix" and "Alix"), every Document named there is offered, and a
  bulk link leaves that spot alone.

## Aliases

- Other names a Document is found by: "Marie" for "Marie Curie".
- Add an **Aliases** Field to a Linkable type, then fill it in on each Document.
- Or select words in a body, choose **Link to…** in the [Selection menu](peek.md), pick the
  Document, and tick **Also add "…" as an alias**.

## Linking from a selection

Select words in a body and open the Selection menu (Ctrl+.): **Link to** the Document they name,
or search for one. The words become a link in place. See [Peek and selection](peek.md).

## The local graph

A Document's neighbourhood — its links, backlinks and unresolved names — drawn as a small graph
beside it. Place it on a Screen as the **Graph** card. The whole picture is the
[Graph](graph.md).

## Tips

- Following a link opens it in a [Peek](peek.md), so you never lose your place.
- Links into the locked Private folder ask for the password instead of opening.
- Days opt out as targets of unlinked mentions: a date in prose is not offered as a link.

## Related

- [Graph](graph.md)
- [Peek and selection](peek.md)
- [Documents](documents.md)
- [The Vault](vault.md)
