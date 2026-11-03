# Where Acquisition lives today

Input for issue #393 (map #390): folding Acquisition into the Belonging Role. Facts only, from master `44fd3362`. Paths are relative to the repo root; `a:b` is file:line.

## 1. The stored states

- Field `acquisition`, text, four values: `WANTED`, `OWNED`, `BORROWED`, `GONE`. Labels Wanted / Owned / Borrowed / Gone. Defined twice, identical: `apps/library/src/domain/types.ts:5-7`, `apps/arcade/src/domain/types.ts:5-7`.
- Field `acquiredOn`, `"YYYY-MM-DD"` text, `""` = not yet. `apps/library/src/domain/types.ts:36`, `apps/arcade/src/domain/types.ts:31`.
- Only `book`, `comic`, `manga` (Library) and `game` (Arcade) carry them. Cinema and Discotheque have none: `apps/cinema/src/domain/types.ts:10`, `apps/discotheque/src/domain/types.ts:10`, `apps/cinema/src/types.ts:15`, `apps/discotheque/src/types.ts:14`. The shared Parts kit types `acquiredOn` as optional because of that: `packages/parts/src/shelf.ts:13,24`.
- `acquisition` is independent of the Shelf (`engagement`): `apps/library/src/domain/types.ts:4`, `apps/arcade/src/domain/types.ts:4`.
- The edit-state rules (patch-returning transitions), same shape in both Apps:
  - acquire (Owned or Borrowed): sets `acquisition`, stamps `acquiredOn` = today. `apps/library/src/domain/rules.ts:62`, `apps/arcade/src/domain/rules.ts:12`.
  - release (Gone): sets `acquisition` only, `acquiredOn` kept. Library `rules.ts:63`, Arcade `rules.ts:13`.
  - unacquire (Wanted): `acquisition` WANTED, `acquiredOn` cleared. Library `rules.ts:66`, Arcade `rules.ts:15`.
  - `acquisitionPatch(to)` dispatches to the three. Library `rules.ts:73-77`, Arcade `rules.ts:20-24`.
- Rows missing the field: the Library's `normalizeWork` defaults `acquiredOn` to `""` (`apps/library/src/data/repo.ts:24`, Arcade `repo.ts:20`) but does **not** default `acquisition`; a row without it reads `undefined` and `ACQ_LABEL[undefined]` renders nothing.
- No code anywhere stamps or reads a date for Gone or Borrowed returning; there is no lent-to or owner-of field.

## 2. Storage schema

- Fields live in the `documents` collection's `fields` JSON (one type per medium, ADR 0019). The original dedicated `media` collection had real columns `acquisition` (required text, 20) and `acquiredOn` (text, 10): `pocketbase/pb_migrations/1755400000_stats_media.js:167,173`. `1756400000_documents.js:46,241` moved those rows into `documents`; `1756500000_media_split.js:9-21` set `type` to the medium. No PocketBase schema names `acquisition` today: it is a free field in JSON.
- Field declarations (these drive the Peek and Bases; both `guarded: true`, so they move only through the App's transitions):
  - Library: `apps/library/src/types.ts:23` (`acquisition`, label "Owned", select, `column: true`), `:37` (`acquiredOn`, "Acquired on", date).
  - Arcade: `apps/arcade/src/types.ts:20`, `:26`.

## 3. Writes

| Write | Library | Arcade |
|---|---|---|
| Creation default / input | `addWork` input `acquisition` `data/repo.ts:67,91`; `acquiredOn` stamped today for Owned/Borrowed `:96` | `data/repo.ts:50,63,67` |
| Quick add (always WANTED) | `data/repo.ts:175` | `data/repo.ts:132` |
| Bibliography rows ticked (WANTED) | `data/authorActions.ts:105` | none |
| Add dialog ("More details" select, GONE excluded, default WANTED) | `components/AddWorkDialog.tsx:65,94,211,417-422` | `components/AddWorkDialog.tsx:48,67,129,257-262` |
| Work page select (all four, via `acquisitionPatch`) | `screens/WorkScreen.tsx:111-116` | `screens/WorkScreen.tsx:75-80` |
| Work ⋯ menu: Got it / Owned / Gone | `components/WorkActions.tsx:46,73,86` | `components/WorkActions.tsx:56,67` |
| Nightstand row "Got it" button (buy-signal rows) | `components/WorkRow.tsx:65` | none |
| Wanted-list Card tick | `cards/WantedListCard.tsx:26` | `cards/WantedListCard.tsx:26` |
| One-click Bought toggle | `components/QuickActions.tsx:58-73` | none |
| `library.add` Command (`acquisition` arg, default WANTED) | `addCommand.tsx:47,56,59,101` | none (`arcade.add` opens the dialog, `commands.tsx:51`) |
| `library.acquisition` Command ("Set acquisition") | `stateCommands.ts:47-60` | none |
| Demo seed | via `acquire()` | via `acquire()` |

Arcade has no Command that sets acquisition. All writes go through `patchWork`.

## 4. Reads

- **Labels and badges.** Library: `components/WorkRow.tsx:51`, `components/LibraryPeeks.tsx:26`, `screens/AuthorScreen.tsx:176` (Bibliography "on your shelf — Owned, To read"), `components/QuickAdd.tsx:11`, `components/AddWorkDialog.tsx:173,395` (duplicate warning, "More details" summary), `screens/WorkScreen.tsx:135` (history row "Acquired"). Arcade: `components/ArcadePeeks.tsx:23`, `components/QuickAdd.tsx:10`, `components/AddWorkDialog.tsx:98,253`, `screens/WorkScreen.tsx:47,98`.
- **Daylog.** `daylogFacts` in the shared kit: `acquiredOn === day` yields a fact "Acquired", ranked finished > started > acquired > added: `packages/parts/src/shelf.ts:185-198` (comment at `:127`). Each App's `daylog.ts` (`apps/library/src/daylog.ts:10`, `apps/arcade/src/daylog.ts:9`) is built on it. Guide: "Starting, finishing, buying and Parts read show up in that day's Daylog" `packages/guide/pages/culture.md:47`.
- **Surprise me pool** (an Owned or Borrowed work, unstarted): Library `domain/cardQueries.ts:14` (also `slot === 0`), Arcade `domain/cardQueries.ts:14`; passed to `shelfQueries` in `packages/parts/src/shelf.ts:~130`.
- **Shelf of shame** (Owned, unstarted, oldest `acquiredOn` first): `shelfOfShame`, Library `domain/rules.ts:112-115`, Arcade `domain/rules.ts:29-32`. Not called from any component; only the unit tests exercise it.
- **`library.get` Command text** prints "Acquisition: Owned" and "Acquired on": `apps/library/src/stateCommands.ts:131,136`.
- Work-page frame documents a `status` slot "its Shelf, Acquisition, slot": `packages/parts/src/components/WorkPage.tsx:70`.
- Bases/Peek/search read it through the Field declarations in section 2; no other module names the field. A grep for `acquisition|acquiredOn` outside `apps/library`, `apps/arcade`, `packages/parts`, `shell/e2e` and docs/migrations finds nothing (none in `packages/core`, `mcp/src`, `shell/src` except the demo).

## 5. The Wanted list and its Cards

- Derivation: Library `wantedList` `apps/library/src/domain/rules.ts:116-120` (WANTED; buy-signal rows first, then oldest `addedOn`); Arcade `apps/arcade/src/domain/rules.ts:34-36` (oldest `addedOn`).
- Cards (both with the id `*.shopping`, a leftover name): `library.shopping` "Book wanted list" `apps/library/src/index.ts:59-68`, `arcade.shopping` "Game wanted list" `apps/arcade/src/index.ts:36-43`. Components `apps/library/src/cards/WantedListCard.tsx`, `apps/arcade/src/cards/WantedListCard.tsx`: each row has a tick (`acquire("OWNED")`, toast "owned") at `:26`, title, medium label; Library adds the buy-now cart icon at `:33`. Empty text "Nothing to buy."
- The Library Card takes a `medium` setting (`index.ts:67`, `titleWithMedium`); the Arcade's Card is untitled by medium (it filters `byMedium` anyway, `WantedListCard.tsx:14`).
- Arcade also has a "To play" Card `arcade.want` (`index.ts:81`): not the Wanted list despite the id.
- Tag filter: `tagFilterable: true` on both.
- Terms: CONTEXT.md "Wanted list" `CONTEXT.md:423-425`.

## 6. One-click Bought

- Library only: `BoughtToggle`, `apps/library/src/components/QuickActions.tsx:58-73`. Shown only for WANTED or OWNED (`:59`), title "Bought it" / "Owned — click to undo" (`:65`), uses `toggleOwned` (`rules.ts:69-70`: OWNED goes back to WANTED, clearing `acquiredOn`; otherwise `acquire("OWNED")`). Borrowed and Gone return `null`.
- Placed in the tile's foot strip, `apps/library/src/components/WorkTile.tsx:53` (header comment `:15`, ADR 0035 strip). Guide: `packages/guide/pages/culture.md:56`.
- Arcade has no Bought toggle; it has "Got it (owned)" in the ⋯ menu and the Card tick.

## 7. The Nightstand's buy-now

- Rule: `isBuySignal = onNightstand && acquisition === "WANTED"`, `apps/library/src/domain/rules.ts:52-53`. Library only (Arcade has no slots, `apps/arcade/src/domain/types.ts:15`).
- Readers: Nightstand Card cart icon `apps/library/src/cards/NightstandCard.tsx:42`; Wanted-list ordering and icon (`rules.ts:120`, `WantedListCard.tsx:33`); Nightstand row badge "buy this" and a "Got it" button `components/WorkRow.tsx:20,45-48,64-67`; work ⋯ menu `components/WorkActions.tsx:24,46`.
- Terms: CONTEXT.md "Wanted list" (`:424`, "Nightstand ones first (next up — buy now)"), Nightstand "Slot" (`:420`). Guide: `packages/guide/pages/culture.md:116-117`.
- ADR 0006 (which created Nightstand x Acquisition, "two independent axes"): `docs/adr/0006-media-app-generalises-nightstand-per-medium.md:8,21`.

## 8. Shopping list Handoff and Intake: no link today

- The Shopping list App declares one Intake, "Need", `apps/shopping/src/index.ts:33-34`, dialog `apps/shopping/src/components/AddNeedDialog.tsx:19-47` (prefilled from a `Handoff`). The Contract is `packages/core/src/contracts/intake.ts:46-61`.
- The only App that sends a Handoff to it is Pantry (running-low Provision): `apps/pantry/src/components/HandOffMenu.tsx:5-16` (ADR 0050, 0055). The generic selection/Capture "words" menu also offers a Need (`packages/guide/pages/peek.md:36-41`).
- `grep -iE "handoff|intake"` in `apps/library/src` and `apps/arcade/src` returns nothing. The Wanted list never creates a Need; CONTEXT.md keeps the two apart: "Wanted list" Avoid `cart, shopping list` `CONTEXT.md:425`, "Shopping list" Avoid `Wanted list (Library and Arcade's Wanted works)` `CONTEXT.md:713`.
- The `library.shopping` and `arcade.shopping` Card ids are the only "shopping" in those Apps. The Need Contract text: `CONTEXT.md:49` (Handoff), `CONTEXT.md:716` (Need).
- ADR 0024:14,17 says Library and Arcade have "Acquisition + Shopping list" (meaning the Wanted list).

## 9. Commands and MCP

- Commands that touch it: `library.add` arg `acquisition` (`apps/library/src/addCommand.tsx:47,56-59,101-106`), `library.acquisition` "Set acquisition" (`apps/library/src/stateCommands.ts:47-60`, keywords include wanted/owned/bought/sold, errors "is already X; nothing was changed" `:57`), `library.get` output (`stateCommands.ts:131,136`). Options list `ACQUISITION_OPTIONS` `stateCommands.ts:21`. Library `quick-add` and Arcade `quick-add`/`add` always create WANTED via `repo.ts:175`/`:132`.
- MCP: no MCP source names `acquisition`. `mcp/src/tools.ts:262,274` makes one tool per Command, name from `commandToolName(def.id)` (`:211`, non-alphanumerics become `_`): `library.acquisition` becomes `library_acquisition`, and `library.get` becomes `library_get`, `library.add` becomes `library_add`. Arcade exposes no acquisition tool (`arcade_quick_add` only). `mcp/scripts/e2e.mjs:234-235` exercises `library_quick_add`; no test names `library_acquisition`.
- Guide MCP lines: `packages/guide/pages/culture.md:102` ("Set acquisition ... For Claude"), `:107` ("Show a work").
- Macros can reference the Command ids (`shell/e2e/screens.spec.ts:307` is for `shopping.add`; none for acquisition).

## 10. Demo data

- `shell/src/demo/life/media.ts`: imports `acquire` of both Apps `:3,:15`; books `:72` Owned, `:81` Borrowed, `:87` Owned, `:95` Owned (manga); games `:161`, `:165` Owned. One book is left Wanted (`Blindness`, comment `:89`, no `acquire` call). No Gone anywhere in the demo.

## 11. Tests

Unit (counts of matches for `acquisition|acquiredOn|OWNED|WANTED|wantedList|isBuySignal`):
`apps/library/src/domain/rules.test.ts` 21, `apps/arcade/src/domain/rules.test.ts` 16, `apps/library/src/data/repo.test.ts` 13, `apps/library/src/domain/cardQueries.test.ts` 10, `apps/library/src/addCommand.test.ts` 10, `apps/library/src/stateCommands.test.ts` 9, `apps/arcade/src/domain/cardQueries.test.ts` 7, `apps/arcade/src/data/repo.test.ts` 3, `apps/library/src/data/enrichActions.test.ts` 3, `apps/library/src/lookupCommand.test.ts` 2, both `domain/browse.test.ts` 2 each, `packages/parts/src/shelf.test.ts` 1.

E2E (`shell/e2e`):
- `peek-culture.spec.ts:32` (creates a book `acquisition: "WANTED"`), `:46` (asserts OWNED after the Peek action).
- `library-work-page.spec.ts:19` (seed WANTED), `:51` (asserts OWNED).
- `arcade-work-page.spec.ts:19` (seed WANTED), `:45` (asserts OWNED).
- `jump-to-date.spec.ts:68,75` (seeds `acquiredOn: ""`, `acquisition: "OWNED"`).
- `screens.spec.ts` and `demo.spec.ts` have no acquisition assertions.

## 12. Guide pages (`packages/guide/pages/culture.md`, one page; the only page that mentions Acquisition)

`:47` Daylog; `:56` Bought toggle; `:75-79` work page (Acquisition select, "Shelf, Acquisition and the slot change only through those buttons"); `:92` add dialog ("Acquisition under More details"); `:102` "Set acquisition" Command; `:107` "Show a work"; `:116-117` "Book wanted list"; `:197-202` Arcade "Wanted or Owned", "Got it (owned)", "Gone", work page "Owned" select; `:217` "Game wanted list"; `:288` "A work you've read but still want to buy stays on the Wanted list". `packages/guide/src/index.ts` maps apps to pages; `house.md:66-115` (Shopping list) and `peek.md:36-41` have no Acquisition text. Test enforcement: ADR 0089 (CLAUDE.md "The Guide").

## 13. CONTEXT.md and ADRs

- CONTEXT.md: "Wanted list" `:423-425`; "Shopping list" avoid-line `:713`; "Nightstand/Slot" `:420`; the unrelated "acquisition vs retention" in Knowledge `:773-774`. There is no "Acquisition" entry of its own; the term is defined only inside "Wanted list". Owned/Borrowed/Gone/Bought have no entries.
- ADR 0024 (`docs/adr/0024-media-splits-into-four-family-apps-plus-commonplace-book.md`): `:10` Acquisition meaningless for streamed media (the reason for the split), `:14,17` Library and Arcade keep it, `:15-16` Cinema and Discotheque do not, `:35` "Acquisition fields simply leave the movie/series/music type defs; stray stored values remain harmlessly on old rows". It also bars a shared package (superseded per map #390).
- ADR 0006: the original two-axis model (`:8,21`). ADR 0019: guarded fields moving through App transitions (cited at `apps/library/src/domain/rules.ts:72`). ADR 0035: tile strip. ADR 0050/0055: Intake and Needs. ADR 0069: one type many Roles. ADR 0110 mentions Acquisition in a list of status (`docs/adr/0110-...md:12`). ADR 0073 and 0106 use "acquisition" in another sense (Knowledge).

## 14. How earlier changes migrated stored values

1. **ADR 0024, settings: client copy, once.** Each new App's lookup settings seed from the retired `media_settings` Document `default` "the first time it finds none of its own": Library `apps/library/src/data/repo.ts:327-338`, Arcade `apps/arcade/src/data/repo.ts:162-177` (runs inside `useLookupSettings`, guarded by a module `seeded` flag and "does a row exist"), Cinema `apps/cinema/src/data/repo.ts:199-210`. The old record is left in place. No server step.
2. **ADR 0024, types and Cards: no migration.** "Type ids are unchanged, so documents need no migration; stored `media.*` Card instances are not migrated" (ADR `:20`). Old Acquisition values were left on Cinema/Discotheque rows (`:35`).
3. **PocketBase JS migrations** (`pocketbase/pb_migrations`, 47 files, numbered with `pnpm migrations:next`, `docs/agents/workflow.md:13`) rewrite stored Documents server-side, in the same shape each time: read `fields` JSON (`readFields`), change it, `set("updatedAt", now)` so last-writer-wins clients accept it on pull, `app.save`, and a down step:
   - `1756500000_media_split.js:9-21`: rewrites `type: "media"` rows to `type = fields.medium`, drops `medium` (down step restores).
   - `1757600000_library_authors.js:1-12` (ADR 0052): splits `creator` strings into new `author` Documents, writes `fields.authors`, deletes `creator`; skips already-migrated rows (`:29-30`); done on the server "deliberately", because a client-side pass "races itself across devices and leaves two Frank Herberts" (cites ADR 0047's precedent).
   - `1758400000_retire_bible.js:1-12` (ADR 0071): Documents with a body become Thoughts of the same id (old type kept in `fields.bibleType`); empty ones are tombstoned and marked `fields.retiredBible` for the down step.
   - `1758900000_prices_sightings.js:1-10` (ADR 0084): marks live Receipts with `fields.noticed = true` and `fields.sightingByMigration` so down can undo only its own work.
   - `1756400000_documents.js:46,241`: the one-collection move (`move("media", "media", ...)`).
4. Client side, `packages/core/src/data/db.ts:111` keeps a version for the local Dexie database; `packages/core/src/data/sync.ts:130,215,424` tolerates a collection missing until the server migration has run.
5. Workflow notes on migrations: `CLAUDE.md` ("migrations:next", "migrations:check"), `docs/agents/workflow.md:13` ("Dry-run it on a copy of pb_data before merging, because merging deploys it").

## 15. Facts that bear on a fold, without recommending

- The field name `acquisition` and `acquiredOn` are the same strings in Library and Arcade; four values are identical in both; transitions are copies (rules.ts differ only by Library having `isBuySignal`, `toggleOwned`, `slot`).
- `BORROWED` and `GONE` have no consumer beyond labels, the Surprise pool (Borrowed counts as "have it"), and menus. Nothing reads who lent it or where it went.
- The Peek/Base column for the field is labelled "Owned" (`types.ts:23` Library, `:20` Arcade), the Command and Guide call it "Acquisition".
- The only places that treat the state as a "to buy" signal are the two Wanted-list Cards and the Nightstand buy-now; none writes to the Shopping list.
- `shelfOfShame` is dead outside tests.
