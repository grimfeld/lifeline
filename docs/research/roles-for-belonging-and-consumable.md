# The Role machinery today, and what Belonging and Consumable need from it

Research for #391 (map: #390). Read against master `44fd3362` (2026-11-03). This is a **gap list, not a design**:
for each need it says what works today, what is partly there, and what is missing. Every claim cites the code
that owns it.

**Who wears what (from #390's Notes):**
- Belonging and Consumable are both owned by one new App (working name *Storeroom*), and each has a home type.
- Garment (Wardrobe) and Tool (Workshop), both owned by **other** Apps, play Belonging **by construction** (`playedBy`).
- book, comic, manga, movie, series, music and game **wear** Belonging per Document.
- Consumable **requires** Belonging.

## What a Role is in code today

`RoleDef` (`packages/core/src/documents/roles.ts:15-34`) is pure data: `id`, `label`, `homeType`, `playedBy?`,
`fields`, `wearable?` and `appId` (which the registry fills in). It has **no** hooks, indexes, guarded-write route,
Peek part, panel or dependency on another Role. An App lends Roles through `AppManifest.roles`
(`packages/core/src/manifest.ts:370`). The registry gathers them in `initApps` (`packages/core/src/registry.ts:26`).
A Document's worn Roles are the `roles` key (`ROLES_KEY`, `packages/core/src/documents/types.ts:47`). They sync
inside `fields` and are indexed multi-entry as `*roles` (`packages/core/src/data/db.ts:124,161`).

The two Roles that exist:

| Role | Owner | Home type | `playedBy` | Fields | Wearers |
|---|---|---|---|---|---|
| Author | Library | `author` | none | Author's fields minus `aliases` (`apps/library/src/types.ts:114-119`) | any Linkable type (no `wearable`) |
| Source | Commonplace | `source` | the 7 work types, owned by **4 other Apps** (`apps/commonplace/src/types.ts:20-27`) | **none** | Linkable, not "own words" |

Neither Role has ever needed what Belonging needs: a Role that **lends fields to `playedBy` types** and **has
guarded fields**. Source lends nothing, and Author is not played by any other type.

## The gap list

### 1. `playedBy` across Apps

- **Works:** the membership side. `playsByType` (`roles.ts:50-52`), `rolesOf`/`hasRole` (`roles.ts:61-68`),
  `documentsWithRole` (`roles.ts:125-135`, one `[type+deleted]` read per played type) and `isLinkTarget`/`linkRole`
  (`roles.ts:114-120`) all treat a `playedBy` type as playing the Role. Source already spans four Apps' types this
  way (`apps/commonplace/src/types.ts:24`). `canWear` refuses to put the Role on a type that already plays it
  (`roles.ts:71-75`).
- **Missing:** a `playedBy` type gets **none of the Role's fields**. `fieldsOfDocument` adds only `wornRoles`
  (`roles.ts:87-101`), and `wornRoles` drops any Role the type plays by construction (`roles.ts:55-58`). A test
  pins this down: `fieldsOfDocument({ ...book, roles: ["source"] }, def("book"))` returns the book's own fields
  (`roles.test.ts:59`). So Garment and Tool would have to declare count, state, physical/digital and Storage **on
  their own type defs**. Those fields would then belong to Wardrobe or Workshop (`def.appId`), not to Storeroom.
  That breaks ADR 0069's "a Role's fields belong to the App that defines the Role", and with it every
  ownership-based route below (guarded writes, Peek, hooks).
- **Missing:** nothing checks that a `playedBy` type actually declares the Role's fields, or that Storeroom's
  operations agree with the keys Wardrobe chose.

### 2. Behaviour beyond fields: hooks, guarded fields, Cards and Commands

- **Hooks are missing.** Everything behavioural sits on the **type**: `onDelete`, `onConflict`, `followers`,
  `describe`, `owner`, `peek`/`peekEdit` (`packages/core/src/documents/types.ts`, inside `DocumentTypeDef`).
  `removeDocument` runs only the type's `onDelete`, plus the Recallable precedent `forgetRecallable` that fans out
  across Apps (`packages/core/src/documents/store.ts:157-168`). No Role hook runs when:
  - a wearer is deleted (its place in a Kit, its Storage contents);
  - a wearer moves Workspace;
  - two devices conflict;
  - a Role is **put on** (no defaults such as count 1 and state owned; `addRole` is a raw `putDocument`,
    `roles.ts:139-145`, and the editor writes `roles` directly at `packages/editor/src/DocumentEditor.tsx:186-188`);
  - a Role is **taken off** (`removeRole`, `roles.ts:151-165`; `takeOffRole`, `DocumentEditor.tsx:190-203`).

  `forgetRecallable` (`manifest.ts:401-407`) is the nearest pattern for a Core-run, cross-App cleanup.
- **Guarded fields are partly there.** `FieldDef.guarded` works on a Role field wherever generic code reads
  `fieldsOfDocument`/`withRoleFields`:
  - the form disables it (`packages/editor/src/FieldsForm.tsx:47-49`);
  - text mode rejects edits to it (`packages/core/src/documents/text.ts:128`);
  - MCP refuses to write it (`mcp/src/handlers.ts:93,113,454`).

  What's missing is a way for **anyone but the type's App** to change it: see §5. `allowGuarded`
  (`DocumentEditor.tsx:63`) unlocks *every* guarded field in the form, Role fields included, so a wearer App that
  passed it would get write access to Storeroom's guarded fields. No App passes it today.
- **Commands work.** `CommandArg.linkRole` (`manifest.ts:261`) picks among the home type, `playedBy` types and
  wearers alike (`packages/core/src/commands.ts:75,99,149-151`). Commonplace's capture uses it
  (`apps/commonplace/src/commands.tsx:31`). A "Use one" or "Mark as gone" Command that takes "any Belonging" can be
  written today.
- **Cards work, with App code.** Cards are per App (`allCards`, `registry.ts:46`). A Card over every wearer reads
  `documentsWithRole`, as Library's Authors (`apps/library/src/data/repo.ts:204-207`) and Commonplace's Sources
  (`apps/commonplace/src/data/works.ts:24`) already do. Core's generic Document Card shows worn Role fields
  (`shell/src/surfaces/DocumentCards.tsx:113`), but not `playedBy` ones (§1).
- **The page panel is partly there.** `documentPanels` (`manifest.ts:19-22,414-415`) puts a Role App's panel on
  any Document's page. Library's `AuthorPanel` gates on `hasRole` (`apps/library/src/components/AuthorPanel.tsx:9`).
  But only the Vault's `DocumentEditor` renders panels (`DocumentEditor.tsx:333-339`). Work types open on their own
  Work page (`apps/library/src/types.ts:65`, `packages/parts/src/components/WorkPage.tsx`), which renders none.

### 3. How Role fields show in the wearer's Base, Peek and page

| Surface | Worn Role fields today | `playedBy` Role fields |
|---|---|---|
| **Base**: columns, filters, cells, board drags | **Missing.** `BasePage` builds columns from `def.fields` (`shell/src/bases/BasePage.tsx:108`). So do `filterableFields` (`shell/src/bases/filters.ts:15-17`), `fieldByKey`/`defaultColumns` (`packages/core/src/documents/views.ts:28-37`) and `requestFieldChange` (`views.ts:176`). | Only if the type itself declares them (§1) |
| **Base of a Role** ("all my Belongings") | **Missing.** Bases are per type (`/base/:type`, `shell/src/App.tsx:167`). Nothing lists a Role across types. | same |
| **Peek**, user-defined wearer | Read-only list (`shell/src/peek/PeekContent.tsx:121-145`) | n/a |
| **Peek**, built-in wearer with an App part (every work type: `peekEdit: WorkPeek`, `apps/library/src/types.ts:70`) | **Missing.** Only the App's part and the user's own fields are drawn (`PeekContent.tsx:47-50`). | Only via the type's App's own part |
| **Peek**, built-in wearer without a part | Read-only (`PeekContent.tsx:160-170`) | n/a |
| **Vault page** (`DocumentEditor`) | **Works**: edited beside the type's own, put on and taken off with undo (`DocumentEditor.tsx:180-203,423-457`) | no |
| **Work page** (Library, Cinema, Discotheque, Arcade) | **Missing.** `WorkPage` and `WorkPeekFields` never read Roles (`packages/parts/src/components/`). | n/a |
| Text mode, MCP `get_document`/`update_document` | **Works** (`text.ts:98,137`; `mcp/src/handlers.ts:137-148,454`) | no |
| Link index (backlinks from a Role's link field, such as Storage) | **Works** (`packages/core/src/documents/links.ts:261`) | no |

So a book wearing Belonging would show its count, state and Storage only on the Vault page, in text mode and over
MCP. Those are not where a book is normally opened.

**Minor:** the Peek can't edit Role fields anywhere. Even the user-type Peek lists them read-only.

### 4. Writes to a Role field from the wearer's App ("−1 on a Consumable from the Workshop")

- **Works for plain fields:** `patchDocument` writes any key. "Guarded" is a UI and MCP convention, not a store
  rule. But Apps don't import each other: every App depends only on core, ui, editor and parts, with one exception
  (`apps/projects/package.json` → `app-tasks`). So Workshop can't call Storeroom's repo.
- **Partly there:** the headless route. `allCommands()` (`registry.ts:50`) plus `invokeCommand(def, args)`
  (`packages/core/src/commands.ts:232-236`) can run Storeroom's "Use one" Command by id, with its invariants intact
  (ADR 0062). This is the only cross-App write path that respects ownership today. Nothing types it: Workshop would
  look the Command up by a string id. Loggable (`packages/core/src/contracts/loggable.ts`, ADR 0031) is the
  Contract-shaped precedent for "another App writes, the owner does it".
- **Missing:** `requestFieldChange` (ADR 0020) routes to the **type's** App: `def.appId` at `views.ts:182`, and it
  only looks for the field in `def.fields` (`views.ts:176`). A board drag on a Role field, or any generic request,
  never reaches the Role's App. `AppManifest.requestFieldChange` (`manifest.ts:388`) takes a field key with no Role
  in it.

### 5. One Role requiring another (Consumable requires Belonging)

**Missing entirely.** `RoleDef` has no `requires`:
- `canWear`/`wearableRoles` (`roles.ts:71-80`) would offer Consumable to a Document that isn't a Belonging;
- `addRole` (`roles.ts:139-145`) wouldn't put Belonging on with it;
- `removeRole`/`takeOffRole` would take Belonging off and leave Consumable worn, with its fields;
- nothing models a type playing Consumable by construction (Provision, later) also playing Belonging.

`rolesOf` (`roles.ts:61-64`) has no notion of an implied Role, so `hasRole(doc, "belonging")` would be false for a
Consumable that forgot to wear both.

### 6. Role-aware queries and indexes

- **Works:** "every Document playing role X". `documentsWithRole` reads the `*roles` multi-entry index plus
  `[type+deleted]` per home and `playedBy` type, then de-duplicates and gates (`roles.ts:125-135`,
  `db.ts:124,161`).
- **Partly there:** field indexes are per type. `DocumentTypeDef.indexes` compiles a bare key to `[type+key]`, and a
  bracketed compound is used as written (`types.ts:164-167`, `db.ts:164-166`, `registry.ts:28`). `RoleDef` has no
  `indexes`, so "everything in Storage X" or "Consumables below minimum" can't be an index hit across wearers. One
  workaround exists: the home type declares a bracketed compound (`[storage+deleted]`) that indexes every row that
  has the key, whatever its type. `documentsWhere` (`store.ts:57-60`) only knows `[type+field]`.
- **Missing:** a query helper over a Role field (`documentsWithRoleWhere`). "What's in this Storage" can come from
  link backlinks (§3), but count, minimum and expiry filters would mean loading every Belonging and filtering in
  memory.

### 7. Field-key collisions

A collision keeps the **wearer's** key (`roles.ts:27,94-99`), and nothing warns about one. The keys already in use:

| Keys | Where | Why it matters |
|---|---|---|
| `acquisition`, `acquiredOn` (guarded) | book/comic/manga (`apps/library/src/types.ts:23,37`), game (`apps/arcade/src/types.ts:20,26`) | A Belonging field of the same name would be shadowed on the very types meant to fold Acquisition in. The migration has to remove them from the work types. |
| `state` | Museum (`apps/museum/src/types.ts:89`) | |
| `location` | Museum (`apps/museum/src/types.ts:48`) | |
| `storageId`, `quantity`, `minimum`, `expires` | Pantry's Provision (`apps/pantry/src/types.ts:31-35`) | Matters once Provision plays Consumable ("Pantry joins", not yet specified) |

## Headline gaps

1. **`playedBy` lends no fields.** Garment and Tool would own Belonging's fields themselves, against ADR 0069
   (§1). This is the gap the others depend on.
2. **No Role-level behaviour.** There are no put-on, take-off, delete, Workspace-move or conflict hooks on a Role
   (§2).
3. **Guarded Role fields have no write route through their owner.** `requestFieldChange` goes to the type's App.
   Cross-App writes can only go through `invokeCommand` by string id (§2, §4).
4. **Role fields are invisible where works live.** Bases, the Work page and App Peek parts don't show them, and no
   Role Base exists (§3).
5. **No `requires` between Roles** (§5).
6. **No Role-level indexes or field queries** (§6).
7. **Key collisions** with Library and Arcade's `acquisition`, and Pantry's stock keys, are silent (§7).

## Method

Sources read:
- `docs/adr/0069-one-type-many-roles.md` and `CONTEXT.md` § Role and § Source;
- `packages/core/src/documents/roles.ts` and `roles.test.ts`;
- every caller of `hasRole`, `rolesOf`, `wornRoles`, `fieldsOfDocument`, `withRoleFields`, `documentsWithRole`,
  `linkRole`, `playedBy`, `ROLES_KEY`, `addRole`/`removeRole`, found by grep over `apps`, `packages`, `shell`
  and `mcp`;
- Library's and Commonplace's Role wiring (`types.ts`, `index.ts`, `AuthorPanel`, `SourcePanel`, `data/`);
- the Base (`shell/src/bases/`), Peek (`shell/src/peek/PeekContent.tsx`), Vault editor, Work page (`@lifeline/parts`),
  `requestFieldChange` (`packages/core/src/documents/views.ts`) and the store's delete path.

There is nothing on the server side: PocketBase never reads `roles`.
