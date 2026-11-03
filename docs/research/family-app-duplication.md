# What the four family Apps still copy, and where each copy diverges

Research for issue #392 (map #390). Measured on master `44fd3362` (2026-11-03) from the source
of `apps/library`, `apps/cinema`, `apps/discotheque`, `apps/arcade` and `packages/parts/src`.
Read-only: nothing here designs the shared package.

## Method

- Files listed by path inside each App (195 files). A path present in 2+ Apps is a "same-name" file.
- Pairwise changed-line counts by `difflib` on the files as they stand (`diff` read by hand for every file
  over ~5 lines of difference). Abbreviations: Lib, Cin, Dis, Arc.
- **Identical**: byte-identical, or only a comment differs. **Names swapped**: the only differences are the
  app id, type ids, labels, verbs, icons, colours, `order` numbers, comments. **Real divergence**: the logic
  or the data differs; the divergence is named.
- "Removable" counts below take the lines that survive in every copy (the common core, after swapping
  app names and medium words), so they are a rough floor for what one shared copy replaces.
- Totals (src, tests included): Lib 6,626 lines (1,231 tests), Cin 3,136 (195), Dis 2,863 (142), Arc 2,395 (302).

## Headline

- 15,020 source lines across the four Apps. About **4,800 lines** sit in a core common to every copy of a
  same-name file; about **5,200** once the Cinema/Discotheque/Arcade core that Library does not share is
  added. Add about 190 for two pairs with different names (below). **Rough total: 5,000 to 5,400 lines,
  about a third of all four Apps, and about 80% of what Cin/Dis/Arc would lose** (they total 8,394).
- Cinema and Discotheque are the same App with names swapped nearly everywhere (pair diffs of 0 to 6 lines
  on most files). Arcade differs from them in a few places. Library diverges the most, from Authors,
  the Nightstand and a three-provider lookup chain.
- Parts already carries the logic behind most of this; what is left is mostly glue: cards, dialogs, the
  Work page, the repo, the commands and the manifest, each written four times.

## What `@lifeline/parts` already shares

All four Apps depend on it (`"@lifeline/parts": "workspace:*"`), as do Museum, Manuscript and Writer.
Exports from `packages/parts/src/index.ts`:

| Module | Exports (roughly) |
| --- | --- |
| `domain.ts` | Part/Group model: `PartsMedium`, `Pos`, `runOf`, `nextPart`, `progressOf`, `caughtUpOf`, `partName`, `groupName`, `isRead`, `runComplete`, `averageRating`, `daySummary`, `RATING_MAX` |
| `kit.ts` | `createPartsKit` (typeDefs, `workTypeHooks`, `useAllParts`, `readNext`, `useDaylogItems`) |
| `shelf.ts` | `matchesWorkSearch`, `GALLERY_SORTS`, `sortGallery`, `isLiked`, `SHELVES`, `shelfName`, `onShelf`, `pickIndex`, `shelfQueries` (the card queries: `byMedium`, `inProgress`, `finishedIn`, `surprisePool`, `daylogFacts`...) |
| `enrich.ts` | `applyHit`, `refreshFromHit`, `normalizeTitle`, `confidentMatch` |
| `lookup.ts` | `LOOKUP_ROWS`, `lookupRows` |
| `quickAdd.ts` | `quickAddFromLine`, `startingMedium`, `quickAddPlaceholder` |
| Components | `Marks` (Stars, LikeButton, MarksControls, MarksGlance, ReviewEditor), `NextPart` (`NextPartButton`, `NextPartDialog`), `PartDialog`, `GroupDialog`, `PartsSection`, `ShelfControl`, `QuickPick`, `QuickAdd` (`FamilyQuickAdd`), `WorkPeekFields`, `WorkPage` (the Work page frame), `LookupActions`, `PlaylistsSection` |

Consequence: the Apps' `QuickAdd`, `WorkScreen`, `cardQueries`, `browse`, `enrichActions` and `parts.ts` are
already thin wrappers over `parts`. They still differ per App only in config, which is what is left to copy.

## File-by-file

Differences are changed lines between copies. "All" means every App that has the file.

### Cards and card helpers

| File | In | Class | Diff | Divergence |
| --- | --- | --- | --- | --- |
| `cards/FinishedCard.tsx` | All | Names swapped | Cin/Dis 1; Arc 5; Lib 5 | Comment wording. Cin shows `MarksGlance` and rating/liked in the tooltip (Marks); Arc has none; Lib shows Author names (Authors) |
| `cards/InProgressCard.tsx` | All | Names swapped | 4 to 6 | `libraryParts` / `cinemaParts` / `discothequeParts`. Arc has no Parts, so no `NextPartButton` (Parts) |
| `cards/QuickAddCard.tsx` | All | Names swapped | 1 | Default medium: `book` / `movie` / `music` / `game` |
| `cards/SurpriseCard.tsx` | All | Names swapped (Cin/Dis/Arc); real in Lib | Cin/Dis 0; Arc 2; Lib 13 | Lib's action is "To Nightstand" (`promote`, `freeSlots`) where the others "Start"; Lib shows Author names (Nightstand, Authors) |
| `cards/WantCard.tsx` | All | Names swapped | 1 to 3 | Lib renders `AuthorNames` (Authors) |
| `cards/WantedListCard.tsx` | Lib, Arc | Real (small) | 4 | Lib adds the buy-now cart icon (`isBuySignal`) (Nightstand, Acquisition) |
| `cards/NightstandCard.tsx` | Lib | Library-only | 53 lines | Nightstand |
| `cards/shared.ts` | All | Real | Cin/Dis 11; Dis/Arc 1 | Lib has three medium-knob fields (any, slotted-only, required); Cin one (movies/series); Dis and Arc none (single-type, `mediumOf` returns `""`) |

### Components

| File | In | Class | Diff | Divergence |
| --- | --- | --- | --- | --- |
| `components/Cover.tsx` | All | Identical | 0 | none |
| `components/AddToPlaylistDialog.tsx` | Cin, Dis | Identical | 0 | Playlists |
| `components/PlaylistDialog.tsx` | Cin, Dis | Names swapped | 1 | Playlists |
| `components/PlaylistsTab.tsx` | Cin, Dis | Names swapped | 2 | Playlists |
| `components/Marks.tsx` | Cin, Dis | Names swapped | 2 (doc comment) | Marks (wraps the `parts` Marks) |
| `components/MarkWatchedDialog.tsx` / `MarkListenedDialog.tsx` | Cin / Dis | Names swapped (different file names) | 6 | Marks, verbs "watched" / "listened" |
| `components/FindMetadataDialog.tsx` | All | Cin = Arc identical; Dis names swapped (5); Lib real (31) | see left | Dis uses a stable empty-keys object (MusicBrainz is keyless); Lib adds a typed title/ISBN search box and `BarcodeScan`, and bylines from Authors (lookup providers, Authors) |
| `components/LookupSettingsDialog.tsx` | Lib, Cin, Arc | Cin/Arc names swapped (5: key field, label, href, title); Lib real (14) | 5 / 14 | Lib has two keys (ComicVine, Google Books) and a `ResolveAuthorsSection` (lookup providers, Authors). Dis has none: its lookup needs no key |
| `components/QuickAdd.tsx` | All | Names swapped | Cin/Dis 6; Arc 6 to 8; Lib 15 to 18 | Config object per App; Arc adds the Acquisition label to the duplicate message; Lib uses `author` |
| `components/WorkActions.tsx` | All | Cin = Dis names swapped (2); Arc and Lib real | Cin/Arc 29; Lib 49 to 67 | Cin/Dis add "Mark watched/listened" and "Add to playlist" (Playlists, Marks). Arc has Acquisition items ("Got it", "Gone") but no playlist. Lib has Nightstand items (slot it, evict, free) plus Acquisition |
| `components/WorkTile.tsx` | All | Cin = Dis names swapped (1); Lib close to Cin; Arc real | Cin/Arc 52; Lib/Cin 19 | Cin/Dis tiles carry a hover strip with `WatchedToggle`, `LikeToggle`, menu (Marks); Arc's tile is a plain button without them |
| `components/AddWorkDialog.tsx` | All | Cin = Dis names swapped (6); Arc mostly (28); Lib real | Cin/Arc 28; Lib 231 to 257 | Dis: no settings object (keyless). Arc: an "Owned?" select (Acquisition). Lib: Authors picker, series, ISBN/barcode, Nightstand slot, three providers (467 lines, the biggest file) |
| `components/{Library,Cinema,Discotheque,Arcade}Peeks.tsx` | one each | Cin/Dis names swapped (11); Arc and Lib real | Cin/Arc 44; Cin/Lib 57 | Arc: Acquisition field, no Marks. Lib: Authors, series, Nightstand |
| `components/WorkRow.tsx` | Lib | Library-only (88) | | Nightstand slot age, stale flag, buy-now cart (Nightstand, Acquisition). No copy elsewhere |
| `components/EnrichDialog.tsx` | Dis | Discotheque-only (130) | | MusicBrainz "Enrich all" run; Cin/Arc/Lib reach the same through `LookupSettingsDialog`/`FindMetadataDialog` |
| `components/PlaylistDialog.tsx` etc. | see above | | | Arc and Lib have no Playlists |
| Library-only: `AuthorCandidatesDialog` (84), `AuthorNames` (41), `AuthorPanel` (19), `AuthorPicker` (131), `BarcodeScan` (135), `MergeAuthorDialog` (83), `QuickActions` (76), `ResolveAuthorsDialog` (149) | Lib | Library-only | | Authors, barcode |

### Screens, manifest, commands

| File | In | Class | Diff | Divergence |
| --- | --- | --- | --- | --- |
| `screens/WorkScreen.tsx` | All | Cin = Dis names swapped (23: playlists, fields component, strings); Arc and Lib real | Cin/Arc 38; Lib/Cin 74 | Already a wrapper over `parts` `WorkPage`. Arc: Acquisition select, `review={false}`, no Parts. Cin/Dis: Playlists, Parts. Lib: Authors, series, Nightstand |
| `screens/CinemaScreen.tsx` / `DiscothequeScreen.tsx` / `ArcadeScreen.tsx` / `LibraryScreen.tsx` | one each | Real (partial overlap) | Cin/Dis 58; Cin/Arc 133; Cin/Lib 70 | Cin has a type-chip row (movie/series) and "Liked" chip; Dis only a "Liked" chip and Enrich; Arc own filters (Acquisition); Lib Authors and Nightstand. Same gallery/filter skeleton |
| `screens/AuthorScreen.tsx` | Lib | Library-only (362) | | Authors |
| `index.ts` (manifest) | All | Cin/Dis names swapped plus knobs (44); Arc, Lib real | Cin/Arc 53; Lib 69 to 76 | Card list (`in-progress`, `finished`, `surprise`, `quick-add`, `want`) is the same in all four; Lib adds `nightstand`, `shopping` and Author screen/panel; Arc adds `wanted-list`; settings type only in Lib, Cin, Arc |
| `commands.tsx` | All | Cin = Dis names swapped (31: titles, keywords, icons, the Dis `enrich` command); Arc and Lib real | Cin/Arc 88; Lib 67 to 73 | Same set: quick-add, next-part, add, open, plus per-App: mark watched/listened, new playlist (Cin/Dis), lookup settings (Cin/Lib/Arc), resolve authors (Lib). Arc has no Parts, so no next-part |
| `constants.ts` | All | Names swapped | 3 to 5 | `APP_ID`, `APP_HREF`; Lib adds `authorHref` |
| `daylog.ts` | All | Names swapped | Cin/Dis 3; Arc 5 | Arc has no Parts line (no Parts) |
| `parts.ts` | Lib, Cin, Dis | Names swapped | 6 to 9 | `createPartsKit` config: App title, type ids, `order`, colours, media. Arc has none |
| `types.ts` | All | Cin/Dis names swapped + icons (35); Arc and Lib real | Cin/Arc 56; Lib 73 to 94 | Type defs and fields: Arc acquisition and acquiredOn; Lib authors, slot, Acquisition; Cin/Dis Marks, Playlists, settings type (Cin only) |
| `addCommand.tsx`, `addCommand.test.ts`, `stateCommands.ts`/`.test.ts`, `lookupCommand.ts`/`.test.ts` | Lib | Library-only (108+110, 154+107, 38+85) | | Claude-facing commands for Nightstand/Acquisition state and lookup (Nightstand, Acquisition, lookup providers). Other Apps have no equivalent |

### Domain

| File | In | Class | Diff | Divergence |
| --- | --- | --- | --- | --- |
| `domain/browse.ts` | All | Cin = Dis identical (0); Arc 3; Lib 30 | | Lib adds `sameSeries`/series matching and Author names in search; Cin/Dis re-export `GALLERY_SORTS` including Rating, Lib and Arc drop Rating |
| `domain/cardQueries.ts` | All | Cin = Dis identical; Arc 5; Lib 5 | | One `shelfQueries(WORK_TYPES, pool?)` call; Arc and Lib pass a surprise-pool predicate (Acquisition owned/borrowed; Lib also off the Nightstand) |
| `domain/playlist.ts` (+ test) | Cin, Dis | Identical (code 0; test 2) | | Playlists |
| `domain/rules.ts` | All | Cin = Dis names swapped (4); Arc 30; Lib 103 to 109 | | Shared shape (`start`, `finish`, `abandon`, `toggleDone`). Cin/Dis add Marks (`rate`, `toggleLiked`, `setReview`). Arc adds Acquisition transitions (`acquire`, `release`, `reshelve`, `shelfOfShame`, `wantedList`). Lib adds those plus Nightstand (`promote`, `evict`, `freeSlots`, `isStale`, `slotAge`, `isBuySignal`) |
| `domain/types.ts` | All | Real | Cin/Dis 15; Cin/Arc 41; Lib 52 to 69 | `Work` fields: Acquisition (Arc, Lib), Marks/Parts (Cin, Dis, Lib), slot (Lib), Authors (Lib), `Playlist` (Cin, Dis), settings keys (`tmdbKey`, `rawgKey`, Lib two keys; Dis none) |
| `domain/workTypes.ts` | All | Names swapped (registry of type ids, labels, verbs, units) | Cin/Dis 9; Cin/Arc 15; Lib 17 to 20 | Registry entries per medium; Lib has a `SLOTTED_TYPES` list (Nightstand) |
| `domain/authors.ts` (+ test) | Lib | Library-only (189+81) | | Authors |

### Data

| File | In | Class | Diff | Divergence |
| --- | --- | --- | --- | --- |
| `data/enrichActions.ts` | All | Cin = Arc identical (0); Dis names swapped (3, `LookupKeys` type); Lib real (22) | | Lib fills synopsis, series, original title and creates Author Documents (`ensureAuthorRefs`), takes an optional search string (ISBN) |
| `data/lookup.ts` | All | Real, small copies | Cin/Dis 12; Cin/Arc 8; Lib 77 to 80 | One provider function per App: TMDB (key required, 300 ms gap), MusicBrainz (keyless, 1100 ms gap), RAWG (key); Lib chains Open Library, ComicVine, Google Books. The exported shape (`lookupFor`, `describeLookup`, gap) is the same (lookup providers) |
| `data/lookup.test.ts` | All | Real | 9 to 32 | Matches the provider |
| `data/providers/{tmdb,rawg}.ts`, `data/musicbrainz.ts`, `data/providers/{comicvine,googlebooks}.ts`, `data/openlibrary.ts` | one or two each | Real, each a distinct API | Cin/Arc 57; Cin/Dis 90 | Lookup providers. Not copies of each other |
| `data/providers/providers.test.ts` | Lib, Cin, Arc | Real | 14 to 35 | Per provider |
| `data/repo.ts` | All | Cin = Dis mostly names swapped (50); Arc, Lib real | Cin/Arc 55; Dis/Arc 96; Lib 193 to 261 | Common core (about 120 lines in every copy): `normalize`, `useWorks`, `allWorks`, `addWork`, `patchWork`, `cascadeWorkDelete`, `deleteWork`, `findByExternalKey`, `findTwin`, `quickAddWork`, `parseQuickTitle`. Cin and Arc add lookup settings (with a one-off seed from the retired `media_settings`, Cin only); Dis none; Cin/Dis add Playlists; Lib adds 14 Author functions (list, ensure, merge, delete, restore) and settings |
| `data/repo.test.ts` | All | Real | Dis/Arc 7; Cin/Dis 35; Lib 118 to 130 | Mostly Lib (Authors, Nightstand) |
| `data/authorActions.ts`, `barcode.ts`, `isbn.ts`, `lookupCandidates.ts`, `enrichActions.test.ts` | Lib | Library-only | | Authors, ISBN (ADR 0108) |
| Tests: `domain/rules.test.ts`, `domain/browse.test.ts`, `domain/cardQueries.test.ts` | rules: All; browse, cardQueries: Lib, Arc | Real: tests of the divergent rules above | 5 to 152 | Follow `rules.ts` |

### Config

`package.json` (differs by name and dependencies), `tsconfig.json` (identical, 4 lines) in all four.

## Divergences, named

1. **Nightstand** (slots, promote, evict, stale): Library only, in cards, rules, tile, row, actions, commands.
2. **Authors** (Documents, picker, merge, resolve, byline in search, cards, enrich): Library only.
3. **Acquisition** (Wanted, Owned, Borrowed, Gone, acquire/release/reshelve, Wanted list): Library and Arcade, with the same state set and different surrounding rules (Library ties it to the Nightstand's buy-now).
4. **Playlists**: Cinema and Discotheque only, near-identical in every file (component, repo, domain, types). Library and Arcade have none.
5. **Marks** (rating, liked, review, glance, toggles): Cinema and Discotheque; not Arcade (`review={false}`). Library's use of Marks was not traced.
6. **Lookup providers**: four different APIs (TMDB, MusicBrainz, RAWG, Open Library with ComicVine and Google Books). The App-side files wrapping them (`lookup.ts`, `LookupSettingsDialog`, `FindMetadataDialog`, `enrichActions`, settings type and repo) share one shape. Settings keys and key count differ (0, 1 or 2).
7. **Parts**: Library, Cinema, Discotheque only (Arc has none). Logic is in `@lifeline/parts`; each App's `parts.ts` is config.
8. **Single-type versus multi-type**: Arc (one type) and Dis (one type) drop the medium knob; Cin has two types; Lib has three.

## Rough count of lines a shared package would remove

Common core of each same-name file, after swapping app and medium words, counted `(copies - 1)` times:

| Group | Lines |
| --- | --- |
| Cards (Finished, InProgress, QuickAdd, Surprise, Want, WantedList) | about 650 |
| `Cover`, `FindMetadataDialog`, `LookupSettingsDialog`, `QuickAdd`, `WorkActions`, `WorkTile` | about 1,050 |
| `AddWorkDialog` | about 680 |
| Playlists and Marks (Cin and Dis only): dialogs, tab, `playlist.ts`, tests, `Marks.tsx` | about 485 |
| `enrichActions`, `lookup`, `repo` (+ tests) | about 760 |
| `commands`, `index`, `types`, `parts`, `daylog`, `constants`, `WorkScreen` | about 780 |
| `domain/*` (`rules`, `types`, `workTypes`, `browse`, `cardQueries`) and tests | about 390 |
| **Total (strict, common core of every copy)** | **about 4,800** |

Counting the Cinema/Discotheque/Arcade core that Library does not share raises it to about 5,200, and the
two pairs with different file names (`MarkWatchedDialog`/`MarkListenedDialog`, 110 lines, and
`CinemaPeeks`/`DiscothequePeeks`, 85 lines) add about 190. Tests are about 330 of this.
Figures are approximate: they depend on how names and verbs are normalised, and they say what is
*duplicated*, not what a package could take without a parameter or a seam per divergence above.

## Notes for the next ticket

- Cinema and Discotheque differ so little that most of their files are one file twice.
- Arcade is the smallest and the nearest to "Cinema with Acquisition and without Marks, Playlists and Parts".
- Library's 27% duplication is low only because 60% of it is Library-only (Authors, Nightstand,
  `addCommand`, `stateCommands`, `lookupCommand`, three providers). Where Library does have a copy
  (cards, Cover, dialogs), it is the same shape plus Authors or Nightstand lines.
