# Real note folders: a `folder` path on the Note, titles unique per folder, shortest-path link resolution

Notes get an Obsidian-style folder tree. We chose a real `folder` field on each Note (a `/`-separated path, `""` = root) over a type-derived virtual tree (People / Places / Journal by month) and over folder records. Folders exist because notes are in them; a small local list keeps user-created empty folders alive until their first note. Titles are unique per folder, as on disk. Wikilinks stay name-based (ADR 0009) with Obsidian's rule for ambiguity: an exact `[[Folder/Name]]` path wins, else a unique title anywhere, else the shortest path, then aliases, then App entities. Moving or renaming a note or folder never touches name-form links; path-form links are rewritten. Daily notes live in `Journal/YYYY/MM`, templates in `Templates/`; the vault importer maps directories 1:1.

## Considered options

- Type-derived virtual tree — rejected: no user control over organisation, and the user explicitly wants Obsidian's folders.
- Folder records (a `folders` collection) — rejected: two things to keep consistent, empty-folder edge cases, and nothing on disk works that way; the only thing lost is persistence of empty folders, which is local UI state.
- Globally unique titles — rejected: it forbids `People/Paul` and `Characters/Paul`; per-folder uniqueness plus path links is what Obsidian users already know.

## Consequences

- `notes.folder` is indexed; the tree, breadcrumbs and "move to" are derived from it. Renaming a folder rewrites the `folder` of every descendant note.
- The link index resolves by (path, title, shortest path, alias, App entity); autocomplete offers the path form when a title is ambiguous.
- Existing notes migrate on read: daily → `Journal/YYYY/MM`, template → `Templates`, others → root.
