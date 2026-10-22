# Lifeline

Lifeline is a local-first personal life dashboard. Tasks, chores, events, notes, habits, money, media and
more all live in **one Document store**, and **26 Apps** each own a few Document types. Over that store sit
**Cards** and **Screens** (drag-and-resize dashboards), a **Calendar** with an hour-scaled Schedule, and
**Bases**, which are saved, queryable views over any type. It works offline first, syncs between devices,
runs in the browser and as a desktop app, and has an **MCP server** so an AI agent can read your agenda and
act on it with the same operations the UI uses.

**Try the Demo: <https://lifeline-demo.vercel.app>.** You don't sign in. It opens on a made-up life whose
dates follow today, and everything you do stays in your own browser.

## Architecture at a glance

A pnpm monorepo in TypeScript:

```
shell/           @lifeline/shell: Vite + React SPA. Dashboard, Vault, Screens, Bases, Calendar surfaces,
                 command palette, phone layout. Tauri 2 desktop config in shell/src-tauri.
apps/<name>      26 Apps, one package each, each exporting an AppManifest: its Document types, screens,
                 Cards, Commands and Contract implementations (Tasks, Calendar, Chores, Journal, Notes,
                 Research, Manuscript, Projects, Stats, Life Level, Mood, Workout, Ledger, Pocket, Prices,
                 Pantry, Shopping list, Library, Cinema, Discotheque, Arcade, Museum, Knowledge, Thoughts,
                 Swear jar, Windows)
packages/core    @lifeline/core: the Document store (one `documents` table), type registry (built-in and
                 user-defined types), link index, Views/Bases queries, Contracts, the App registry, and the
                 Dexie offline store with its PocketBase sync engine
packages/editor  @lifeline/editor: CodeMirror markdown editor, reading view, generic Document/Fields editors
packages/parts   @lifeline/parts: Parts and Groups (chapters, episodes, tracks) shared by the media Apps
packages/ui      @lifeline/ui: the shared component kit and design tokens (shadcn + Tailwind)
pocketbase/      the sync backend: PocketBase migrations (pb_migrations) and server hooks (pb_hooks)
mcp/             the remote MCP server: Core and the Apps running headless, one worker per Account
packages/guide   @lifeline/guide: the in-app manual (Markdown pages, also served by the MCP `guide` tool)
packages/extension @lifeline/extension: the Lifeline extension (Send to Lifeline from a web page)
packages/handoff @lifeline/handoff: the Handoff codec (ADR 0080), shared by the shell and the extension
```

Some ideas the code is built around:

- **One store, many types.** Every record is a Document of a Document type. Apps don't own tables. They
  register types and implement Core's **Contracts** (Schedulable, Timed, Loggable, Linkable, Locatable,
  Taggable…), and the shared surfaces (Calendar, Today, Bases, search, the agent) work through those Contracts.
- **Local-first.** Writes land in IndexedDB (Dexie) straight away and sync to PocketBase with last-write-wins,
  so the app works fully offline and queues changes until you sign in.
- **The agent is just another device.** The MCP server runs Core and the Apps unchanged over an in-memory store
  that syncs like a phone does. A headless Command (for example `tasks.add`) becomes an agent tool by declaring
  its arguments.

The language is defined in [`CONTEXT.md`](CONTEXT.md) (the glossary) and the decisions in
[`docs/adr/`](docs/adr). Read the ADRs in number order to see what was built, in what order and why. The
coding rules are in [`CODING_STANDARDS.md`](CODING_STANDARDS.md).

## Running it locally

Needs Node 22 and pnpm 9 (corepack picks the pinned version).

```sh
pnpm install
pnpm dev            # shell on http://localhost:1420, offline only (no backend)
pnpm dev:all        # installs, downloads the pinned PocketBase, runs backend (:8090) and shell together
pnpm typecheck      # all packages
pnpm test           # unit and domain tests
pnpm check          # what CI runs: scripts' tests, UI rules, ADR and migration numbering, typecheck, tests
                    # (CI also re-runs the tests under fr_FR and America/Los_Angeles)
pnpm test:e2e       # Playwright screen checks at phone and desktop widths (slow; CI runs the changed specs on every PR, the full suite on integration PRs and nightly)
pnpm tauri dev      # desktop shell (needs Rust)
```

With `pnpm dev:all`, create a superuser in the PocketBase admin UI (<http://127.0.0.1:8090/_/>), then add a
regular `users` record and sign in from the shell's sidebar. The shell reads `VITE_PB_URL` (default
`http://127.0.0.1:8090`). To build the Demo instead, use `VITE_DEMO=1 pnpm build` (ADR 0077).

### MCP server (ADR 0062)

```sh
pnpm --filter @lifeline/mcp build
node --env-file=mcp/.env mcp/dist/server.mjs     # BASE_URL, PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD, TZ
node mcp/scripts/e2e.mjs http://localhost:8787 <email> <password> [<pocketbase-url>]   # OAuth + every tool, against a scratch PocketBase (default http://127.0.0.1:8099)
```

An MCP client (Claude, or any other) connects to `<BASE_URL>/mcp`. The person signs in on the server's own OAuth
page, and the agent gets `guide`, `list_workspaces`, `list_types`, `agenda`, `search_documents`, `get_document`,
`complete_item`, `move_item`, `reschedule_timed`, `create_document`, `update_document`, `list_macros`,
`create_macro`, `update_macro`, plus one tool per headless Command and one `macro_…` tool per Macro (ADR 0095).
It never sees the Private folder and cannot delete.

### Adding an App (ADR 0003)

1. Add a package under `apps/<name>` that exports an `AppManifest`.
2. Register it in `shell/src/apps.ts` (`APPS`) and `mcp/src/apps.ts`, add the package to
   `shell/package.json` and `mcp/package.json`, and add its `src` to the `@source` list in `shell/src/index.css`.
3. Join exactly one Guide page's `apps` list in `packages/guide/src/index.ts`; the shell test fails without it.
4. Bump `DB_VERSION` in `packages/core/src/data/db.ts` only if the store set or indexes change (a type that
   declares indexed fields or local tables), so Dexie migrates existing local databases.

Offline storage, sync, palette entries, the card picker and calendar presence all come from Core.

## Source-available, not open source

Lifeline is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You're free to read it, run it
and learn from it for any noncommercial purpose. Commercial use isn't permitted.

This is a personal project, so pull requests aren't accepted.
