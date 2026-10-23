# Documents

Everything you keep in Lifeline is a **Document**: a Task, an Event, a Chore, a Note, a Day, a
book. This page covers what every Document has, whatever its type.

## What every Document has

- **A type** — exactly one. It decides the fields, how the title is made and whether there is a
  body to write.
- **A title** — typed by you, a date (a Day), or made from its fields (a transaction).
- **Fields** — typed values: a date, a number, a choice, a link to another Document…
- **Tags** — free words for grouping across types.
- **A Folder** — where it sits in the [Vault](vault.md)'s tree.
- **A body** — markdown text, where the type allows one (always, optionally, or never).

## Types

- **Built-in types** — Task, Event, Chore, Note, Transaction and the rest. Each belongs to one App
  inside a Module, which alone decides how it behaves.
- **Your own types** — Person, Place, Recipe, whatever you need. Make one in [Bases](bases.md)
  with **New type**, or in the Journal under its Types.
- When you make or edit a type you choose:
  - **Name** and **Icon**.
  - **Default folder** — where new ones land.
  - **Home Module** — where its Documents open (People and Places in the Journal), or none, and
    they open in their Base.
  - **Writing** — always (each one is a page to write), optional, or none (fields only).
  - **Linkable** — whether `[[links]]` can point at it. See [Links](links.md).
  - **Fields**, and for some types the **Reports** shown on its pages.
- Your own type gets everything generic: a Base, a form, a body, the generic Cards.
- A type of yours can be deleted only once no Document of it is left, in any Workspace. Lifeline
  asks before it deletes one.
- A built-in type you edited (say, added a Field to) can be **reset to default**.

## Fields

- Kinds: text, long text, number, yes/no, date, date and time, choice, multi-choice, url,
  coordinates, list of text, and **Link** (to another Document, optionally of one type).
- You can add Fields to any type, built-in ones included; the built-in ones stay as they are.
- A Field can be relabelled; its kind can change only to one every existing value still fits.
- Removing a Field keeps the values Documents already hold; add it back and they return.
- Two Fields Lifeline acts on:
  - **Aliases** — other names `[[links]]` find the Document by (Linkable types only).
  - **Coordinates** — puts the type's Documents on the [Map](map.md).
- Some built-in fields are **guarded**: they change only through their App (ticking a Task, not
  editing its status). A 🔒 note in the Base says so.

## Tags

- Lower-case words: `garden`, `health/gym`. The same word is the same tag everywhere.
- Add them in a Document's **Tags** box, or write `#garden` in its body.
- Nothing to manage: the list of tags is simply every tag in use.
- Tags filter Cards and whole Screens. See [Screens and Cards](screens.md).

## Folders

- Every Document sits in a Folder, the root by default. Folders matter only in the
  [Vault](vault.md)'s tree.
- Each type has a home Folder where new ones land: Days in `Journal/YYYY/MM`, templates in
  `Templates`.
- Right-click a Folder in the Vault for New…, New folder, Rename, Move to… and Delete (empty
  only). Drag Documents between Folders.

## The Private folder

- A folder called `Private`, whose Documents show only while it is **unlocked**.
- Set it up once with a password: the lock icon in the Vault's Files pane, or **Set up private
  notes…** in the palette.
- **Locked**, its Documents vanish from everything — tree, search, links, Graph, Bases, Cards. A
  link into it asks for the password.
- It locks again after ten minutes without use (or ten minutes in the background), and when the
  app reloads.
- Only body-first Documents (notes, thoughts…) can go in it.
- It keeps eyes off, but it is not encryption.
- In the palette: **Unlock private notes…**, **Lock private notes**, **Change private notes
  password…**, **Turn off private notes…**.

## Templates

- A Template is a starting body for new Documents of one type: the Day's sections, a meeting
  note.
- Open them from [Bases](bases.md): the template button on a type's row.
- Picking one copies its text into the new body once; later edits to the Template change
  nothing already made.
- Placeholders: `{{title}}`, `{{date}}`, `{{time}}`.

## Attachments

- Drop or paste an image into a body to attach it. It is embedded by name: `![[photo.png]]`.
- Attachments are not Documents: no type, no tags, not in the tree.
- Removing the embed keeps the image. **Clean up unused attachments…** in the palette removes
  the ones no body uses any more.
- An image linked from another site (`![](https://…)`, often in a clipped page) waits for a click
  when you read the body: loading it would tell that site you are reading. **Load** shows it once;
  **Always from …** trusts that site on this device.

## Opening a Document

- A Document opens in its **Home Module** — a Chore in House, a Category in Money.
- From anywhere else — a link, a search result, a Surface — it opens in a [Peek](peek.md) beside
  you.
- Its body can always be written in the [Vault](vault.md).
- The **⋯** menu on a Document: open its Base, take on or drop a Role (say, "Also an Author"),
  **Delete**.

## Deleting and Undo

- A delete happens at once; there is no "Are you sure?".
- Where the toast offers **Undo**, tap it to take the delete back.
- Only what cannot come back asks first: deleting a type, or a Workspace.

## Ask Claude

- Find and read Documents: `search_documents`, `get_document`, `list_types`.
- Make or change body-first and your own types: `create_document`, `update_document`.
  See [Claude](connector.md).

## Related

- [Bases](bases.md)
- [The Vault](vault.md)
- [Links](links.md)
- [Workspaces](workspaces.md)
