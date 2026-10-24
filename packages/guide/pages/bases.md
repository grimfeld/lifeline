# Bases

A **Base** is the one table of one Document type: every Task, every Person, every Transaction,
for sorting, filtering and editing many at once. There is one Base per type; adding a type adds a
Base.

## The Bases list

Open **Bases** on the Rail (or **Go to Bases** in the palette).

- Every type, with how many Documents it holds, and which App owns it (or "user-defined").
- **New type** — make a type of your own. See [Documents](documents.md).
- The pencil — edit a type: its name, icon, folder, Home Module, Fields.
- The template button — the type's Templates.
- Reset (built-in) or delete (yours) — a type of yours can go only once it holds no Documents.
- **Internal types** — folded at the foot: types that only serve another Document.

## Inside a Base

- **New …** — make a Document (types of your own; built-in ones are made in their Module).
- **Open in …** — jump to the owning App's own page.
- **Search…** — narrow by text.
- **Filters** — field · condition · value: is, is not, contains, any of, >, <, is empty, is set.
- **Sort** — by any field, up or down.
- **Columns** — which fields show.
- **Edit in place** — click a plain field in the table to change it, or Tab to it and press
  **Enter**. **Escape** closes it and leaves you on the cell; a yes/no field is a box you tick
  where it stands.
- A long Base shows its first 200 rows, and more as you scroll down (or **Show more**).
- **Select** several (checkboxes) to:
  - **Add tags**;
  - **Move to workspace** (see [Workspaces](workspaces.md));
  - **Delete** — each one goes on its own; one a type refuses (an Offence that has Fines) stays selected,
    and a message says why.
- The footer says how many of how many show, and which fields are guarded (🔒: they change only
  through the owning App).

## Views

A **View** is a saved way of looking at a Base: its filters, search, sort, columns and layout.

- Every Base starts with **All**.
- Change anything, then **Save "…"** to update the View, or **Save as…** for a new one ("To
  read", "Open · work"). **Reset** throws the changes away.
- **+ View** adds one; the **⋯** menu renames or deletes it.
- A View can be placed on a Screen as a **View** card, or counted by a **Count** card. See
  [Screens and Cards](screens.md).

## Layouts

Pick one from the layout switch beside Columns. Some need a field of the right kind, and only
show when the type has one.

- **Table** — rows and columns; edit in place.
- **List** — one line each.
- **Cards** — a grid of small cards.
- **Gallery** — pictures, read from an image URL field.
- **Map** — pins, read from a Coordinates field.
- **Board** — columns by a choice field; drag a card to change it, or use its **⋯** menu (**Move
  to** a column) — on a phone or the keyboard too. A guarded field moves only if its App agrees.
- **Calendar** — a month, by a date field. It only shows; it never moves anything.

A layout that cannot place a Document (no picture, no place, no date) leaves it out and says so:
"12 shown · 3 without location". Click that to see them.

## On a phone

- The View picker and a **⋯** menu (save, new view, rename, delete, Open in …) sit in the Phone
  dock.
- Search sits in the dock; sort, columns and layout fold behind **Filters**.

## Tips

- Bases are the raw layer: plain and the same for every type. For the real work on a type, use
  its Module.
- The palette has an **Open … Base** entry for every type: type "base" and the type's name.

## Related

- [Documents](documents.md)
- [Screens and Cards](screens.md)
- [The Vault](vault.md)
- [Workspaces](workspaces.md)
