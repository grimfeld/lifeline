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
- The editor's header controls derive from the type definition, so a Document is
  never offered a control that can do nothing for it: no raw "frontmatter + body
  as text" view for a type with no visible Fields (it would be the body, which
  the editor already is), and no links panel for a type that is not a wikilink
  target — a Template has neither backlinks nor a local graph.
  **This does less for a Note than first assumed.** `note` declares one visible
  Field (`aliases`) and is linkable, so it keeps both controls; and the Fields
  strip cannot be gated on Fields at all, because Tags live in it for every
  type. What quiets a Note's header is the header receding while you write (ADR
  0021, amended), not the type. The rule earns its place on Templates and on
  types with no fields, and it stops the header growing controls for Documents
  that cannot use them.
- Any App that wants a specialised editor puts it in the Vault. An App screen in
  the Dashboard lists, filters and starts things; the body it opens is the
  Vault's.
- CONTEXT.md's **Workspace** entry is rewritten around write-vs-operate, **Vault**
  with it, and a **Dashboard** entry is added — it had none, existing only as a
  parenthetical inside Workspace.

## How Versions survive the move

The pad's Versions are the one piece of it that is not generic, so they decide
whether "editing lives in the Vault" is a real rule or one with an asterisk.
They become a **document panel** — the mechanism Core already has for exactly
this (`DocumentPanelDef`, added for the Bible App's unlinked references, ADR
0032): an App hangs a panel on every open Document and returns null for the
ones it has nothing to say about. The Writer's pad registers one that renders
for a `writing` and nothing else.

The panel carries the list *and* the actions, so no new Core surface is needed:
**Take a version** sits at its head, and each row offers View, Restore and
Delete. It costs nothing on the phone either — below `md` the Vault's panel is
already a right sheet (ADR 0021, 2026-08-28), which is the same bottom-drawer
shape the pad's own Versions list had.

**Side-by-side compare is kept, as a dialog.** A 16rem panel cannot hold two
texts, so viewing a Version opens it beside the current one — two columns on the
desktop, stacked on a phone — with Restore in the footer. This is the one place
the move changes the shape of an existing feature rather than relocating it: the
pad compared inside the page, the Vault compares over it.

## Settled while building

- **The Vault's tabs are a fixed list** — Notes, Clippings, Writings — the way
  `NAV_GROUPS` is fixed (ADR 0041). User-pinnable tabs were considered and
  deferred for ADR 0041's own reason: phone chrome preferences are per-device
  and unsynced, so a hand-pinned set would not follow the user to another
  device, while a list in code travels with it. Revisit when a fourth folder
  genuinely wants a tab.

## Amendment (2026-09-07): the Workspace is the Frame, and the phone tabs give way

Two changes from ADR 0047 and ADR 0049, neither touching this ADR's actual
decision — the Vault writes, the Dashboard operates, chrome follows the type
and the Vault's tabs follow the Folder.

**The noun.** What this ADR calls a Workspace is now the **Frame** (ADR 0012,
amended). "Two ways of working still want two chromes" is unchanged, and so is
the reason the Vault can never be a Module: a body is edited there whatever its
type, so it is cross-Module by construction.

**The phone tabs.** This ADR's `Notes · Clippings · Writings` folder tabs gave
the Vault a bottom bar of its own. ADR 0049 gives the bar's middle to the
Workspace's Modules instead, so the folder tabs move inside the Note-taking
Module's screen. The reasoning survives — where you go is a Folder, what
furniture you get there is the type's — one level down.

**And the Frame crossing loses the slot this ADR's amendment gave it**, one
release on. It moves to the phone header, beside the Workspace switcher. ADR
0049 states the reversal plainly; the hole that amendment closed stays closed,
because the header is at least as visible as the slot was.
