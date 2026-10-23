---
status: accepted
supersedes: ADR 0013 (in part — the migration rule "others → root")
superseded-by: ADR 0068 (in part — the type-shaped Vault root)
---

# Notes get a Folder of their own, and the vault root becomes type-shaped

`note` was the only body-first type with no home Folder: Clipping →
`Clippings`, Writing → `Writings`, Daily → `Journal/YYYY/MM`, Template →
`Templates`, the Bible's types → `Bible/…`, and Note → `""`, the root. So the
root of the tree was two things at once — the top of the vault *and* the Notes
folder — which is why Notes had nowhere to be pointed at: the Vault's phone
tabs are Folders (ADR 0021, amended), and Notes had none.

**`note` gains `folder: "Notes"`**, and **Notes sitting loose at the root are
migrated into it**. Notes already filed in a topic folder — `People/Paul`,
`Projects/…` — are left exactly where they are; only the loose ones move.

`Notes/` is a **default, not an invariant**. A Note in `Private` is not in
`Notes/`, and that is correct: the Private folder takes any body-first type
(ADR 0038). This is the same status `Clippings` has for a Clipping — where a
new one lands, not a rule about where they may live.

The consequence to name plainly: the vault root stops being **topic-shaped**
and becomes **type-shaped** — `Notes/`, `Clippings/`, `Writings/`, `Journal/`,
`Templates/`, `Bible/`, `Private/`. That is a change of philosophy from ADR
0013, whose founding example was `People/Paul` beside `Characters/Paul` at the
root. Those folders still work and are untouched; they simply sit beside the
type folders instead of being the whole of the root.

## Considered options

- **Leave the root as the Notes folder** — rejected: the root then means two
  things, a type's home and the top of the tree, and the Vault's Notes tab has
  no folder to point at that isn't "everything".
- **Default for new Notes only, no migration** — rejected: it splits the vault
  permanently, old notes loose at the root and new ones in `Notes/`, with the
  tree showing both a `Notes` folder and a pile of notes that are not in it.
  Half a convention is worse than either whole one.
- **Migrate every Note, topic folders included** — rejected: `People/Paul` is
  the user's own organisation and ADR 0013's motivating case; burying it at
  `Notes/People/Paul` takes away the thing that ADR was written to give.
- **A virtual "Notes" view rather than a real folder** — rejected for the reason
  ADR 0013 gave the first time: nothing on disk works that way, and the tabs are
  meant to be folders.

## Consequences

- ADR 0013's migration rule "others → root" is superseded by "others → `Notes`"
  for the `note` type; the rest of that ADR (per-folder unique titles,
  shortest-path link resolution, folders existing because Documents are in them)
  is untouched.
- **Wikilinks are unaffected.** A root note's path *is* its title, so a link to
  one is name-form, and a name-form link is never rewritten by a move (ADR
  0013). `[[Paul]]` keeps resolving by unique title from `Notes/Paul`.
- **Title uniqueness holds through the migration** without special handling:
  notes that were unique at the root are unique in `Notes/`.
- The migration is one-way and touches real content, so it runs once, like ADR
  0013's, and moves only Documents of type `note` whose folder is empty.
