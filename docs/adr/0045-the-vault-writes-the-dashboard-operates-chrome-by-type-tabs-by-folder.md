# The Vault writes, the Dashboard operates — chrome follows the type, tabs follow the folder

ADR 0012 split the app into two Workspaces because "the two chromes differ in
more than the sidebar". That is true but it is not the distinction that
matters. The split that actually holds is **what you do**: the **Vault** is
where content is *written* — a raw body, freely, in a markdown editor; the
**Dashboard** is where data is *read and operated* — Screens, Surfaces, App
screens and Bases, where what changes changes through a defined operation, a
form or a dialog or a click whose effect is known, never through free text.

The code was already 90% shaped this way and nobody had said so. A `clipping`
declares no `href` override, so the Clippings desk in Study is a Dashboard index
whose rows open the body in the Vault. A `note` the same. Daily notes open the
Journal. **`writing` was the lone exception**: it overrode `href` to `/write/:id`,
putting the single most editing-heavy screen in the app — prose, Versions, the
accessory bar — inside the Dashboard. That exception is now removed rather than
documented: a Writing opens in the Vault like every other body, the Writings
desk becomes a pure index like Clippings, and Versions move into the Vault's
editor as chrome the `writing` type declares.

**Chrome follows the type; tabs follow the folder.** These are two axes and
they are easy to confuse, because today they are near-isomorphic — every
body-first type has a home Folder, so "the folder I am in" reliably *is* "the
type I am working with". They must not be conflated. What furniture a Document
gets in the editor is a fact about its **type** (a Writing has Versions
wherever it lives); where you *go* is a **Folder** (the Vault's phone tabs are
folders). The one thing a Folder legitimately decides is **what "+" creates in
it** — a creation default, not editor behaviour.

## Considered options

- **Folder-driven editor chrome** ("the editor's features change based on the
  folder we are in") — rejected, and it is the option this ADR exists to close.
  `Private` is by specification a **mixed-type folder** (`mayBePrivate` admits
  any body-first type; CONTEXT.md: "Only body-first Documents — Note, Clipping,
  Writing — may be created or moved into it"), so a folder-driven editor has no
  answer for what to render there. It also makes moving a file destructive:
  dragging a Writing into `Notes/` would take its Versions away. And ADR 0019
  already settled the axis — "built-in types are the only ones an App's
  behaviour may depend on" — while a Folder is a user-editable path. The editor
  already takes the type definition and builds the Fields form and body policy
  from it; there is no folder in it.
- **Leave the Writer's pad as a documented exception** — rejected. A `Writings`
  tab in the Vault's phone nav (ADR 0021, amended) whose documents bounce to a
  Dashboard route is incoherent, so the nav forces the question. And an
  exception that only lives in prose is how this one survived unnoticed in the
  first place.
- **Collapse to one Workspace** now that the rule is a sentence — rejected:
  ADR 0012's reason is unchanged; two ways of working still want two chromes.

## Consequences

- `writing.href` drops; a Writing opens at the generic Vault document route
  like every other body. The `writer.pad` screen and the `/write/:id` route go
  with it, and the Writings desk keeps only its index job.
- The Versions machinery — snapshot, compare, restore — becomes per-type chrome
  in the Vault's editor. ADR 0021's "Writer's pad grows a phone layout"
  amendment is **superseded in the part that describes the pad's own header and
  Versions sheet**; the phone-layout reasoning behind it (give the width to the
  text) survives, now as the Vault editor's behaviour for every type.
- The editor's header controls derive from the type definition, so a type
  declaring no Fields shows no Fields toggle and no raw-frontmatter view. This
  is most of what made a Note's header noisy: `note` declares exactly one Field.
- Any App that wants a specialised editor puts it in the Vault. An App screen in
  the Dashboard lists, filters and starts things; the body it opens is the
  Vault's.
- CONTEXT.md's **Workspace** entry is rewritten around write-vs-operate, **Vault**
  with it, and a **Dashboard** entry is added — it had none, existing only as a
  parenthetical inside Workspace.
