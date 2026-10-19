# Lifeline

Personal dashboard/OS: one Document store (ADR 0018), hand-written Apps owning built-in Document types (ADR 0019), user-defined types, and Cards / Screens / Surfaces / App screens / Bases over them. See `CONTEXT.md` for the ubiquitous language and `docs/adr/` for the decisions.

## Layout

```
packages/core    @lifeline/core — Document store (one `documents` table), type registry (built-in + user-defined), link index,
                 frontmatter projection, Views/Bases query, contracts, app registry, Dexie offline store + PocketBase sync engine
packages/editor  @lifeline/editor — CodeMirror markdown editor, reading view, generic DocumentEditor / FieldsForm / LinksPanel
packages/ui      @lifeline/ui — shared shadcn/Tailwind component kit (unified look)
apps/clipper     @lifeline/app-clipper — Clipper: `clipping` (pasted text + source; never fetches)
apps/writer      @lifeline/app-writer — Writer's pad: `writing` + manual `writing_version` snapshots, side-by-side compare/restore
apps/chores      @lifeline/app-chores — first App (ported from chore-scheduler)
apps/tasks       @lifeline/app-tasks — Tasks App (absorbs week-planner + calendar's task half):
                 one-time + weekly/monthly/yearly recurring tasks, per-Occurrence complete/move, Unassigned pool;
                 a missed Occurrence lapses when the rule produces the next one, so a recurring task is overdue
                 at most once (ADR 0036)
apps/calendar    @lifeline/app-calendar — Calendar App: Events (timed / all-day / multi-day),
                 shown on the month, week and Today surfaces via the Timed contract; Event templates (quick add onto a
                 slot) and Time blockers (weekly bands painted behind the Schedule), ADR 0027; one-off blockers dropped
                 from Blocker templates and dragged on the Schedule, ADR 0029
apps/bible       @lifeline/app-bible — Bible App (ADR 0032): a lens over the study — owns Verses (one per verse, ranges expand),
                 Chapters, Bible books, Characters, Concepts (created on first mention); lists the Notes/Clippings/Writings that
                 link them, a scoped Graph, an unlinked-references panel in the Vault, a phone screen with "Note on a verse"
apps/workout     @lifeline/app-workout — Workout App (ADR 0030): Workouts as Blocks of intervals (EMOM / AMRAP / Tabata /
                 For Time / Intervals), a full-screen timer, hand-curated Exercises, Sessions as Timed + Daylog records,
                 derived PRs; Tallies feed Habits and Stats through the Loggable contract (ADR 0031)
apps/mood        @lifeline/app-mood — Mood App (ADR 0044): one Mood per day on a fixed five-point scale, drawn as a grid
                 (a month or a whole year) that is also how you set a day; a today's-mood card, and the day's mood
                 reported into the daily note through the Daylog
apps/prices      @lifeline/app-prices — Prices App (ADR 0045): what regular purchases cost, where, and over time —
                 Products (a measure, never a pack size) × Shops (chains); Receipts own Lines (amount, price paid,
                 promo), typed in by hand or read from a photo by an agent over MCP (ADR 0075) — Lifeline
                 itself reads no photo; unit price, cheapest shop and per-shop change are derived, never stored
apps/mail        @lifeline/app-mail — Mail App (ADR 0051): a window onto Gmail — Mailboxes (one per address, the only
                 Document type), Threads read live into a local-only cache and triaged at Google (archive, read, star,
                 label, trash), never sent; a Message is kept as a Clipping, Task or Event through the Intake
                 Contract (ADR 0050); Google's browser token flow, so browser builds only
apps/stats       @lifeline/app-stats — Stats App (notch port): additive / measurement / boolean /
                 collection stats, entries as an event log, derived totals, streaks, Recharts graphs
apps/notes       @lifeline/app-notes — Notes App (Obsidian-style, ADR 0009): markdown notes with typed Note types
                 (built-in daily/person/place/plain + user-defined types & templates), wikilinks + backlinks across notes and other Apps' entities (Linkable),
                 CodeMirror 6 editor, `daylog` blocks (Daylog contract), the Journal Surface; conflict copies (ADR 0010);
                 notes with a `location: [lat, lon]` property are Pins on the map (Locatable, ADR 0011)
apps/sources     @lifeline/app-sources — Sources: things outside Lifeline shown inside it (ADR 0016/0017): Embed (a page in a
                 frame), Feed (RSS/Atom, "seen up to" only), Calendar subscription (iCal → read-only Timed items in its colour),
                 Live value (one JSON-path/regex value polled on a period); Embed/Feed/Live value cards, Sources screen, full-page view
apps/media       @lifeline/app-media — Media App: books, comics, movies, series, albums, games on one Shelf
                 (To read/watch/listen · In progress · Done · Dropped), one Gallery, quick add; Nightstand slots for books/comics
shell            @lifeline/shell — Vite + React shell: Dashboard + Vault workspaces, Bases (/base/:type, saved Views), generic
                 View/Document/Count cards, sidebar (App screens shelved into Nav groups, ADR 0041), command palette (Ctrl+K),
                 user Screens (drag/resize card grids), calendar + week + schedule (hour-scaled time-blocking, ADR 0015; many blocks per item, ADR 0028) + map Surfaces; Tauri 2 desktop config
pocketbase       Dockerfile + fly.toml (app: lifeline-pb) + pb_migrations
scripts          dev.sh (backend + shell), import/ (legacy data → Lifeline, see docs/retire-legacy.md)
```

## Dev

```sh
pnpm install
pnpm dev            # shell on http://localhost:1420
pnpm typecheck      # all packages
pnpm test           # domain tests
pnpm tauri dev      # desktop shell (needs Rust; first run generates icons via `pnpm tauri icon <png>`)
```

Local backend (optional — the app is fully usable offline; writes queue until sign-in):

```sh
pocketbase serve --http=127.0.0.1:8090 --migrationsDir=pocketbase/pb_migrations
pocketbase superuser upsert you@example.com <password>
# then create a regular `users` record via the admin UI, and sign in from the shell sidebar
```

The shell reads `VITE_PB_URL` (defaults to `http://127.0.0.1:8090`). Point it at the Fly instance for production builds.

Mail (ADR 0051) reads `VITE_GOOGLE_CLIENT_ID`: an OAuth client of type *Web application* in your own Google Cloud project, with the
Gmail API enabled, the `gmail.modify` scope on the consent screen, your Google account listed as a test user, and the dev
(`http://localhost:1420`) and deployed origins as authorised JavaScript origins. Without it the Mail screen says so; nothing else
changes. Mail works in browser builds only (Google's token flow needs an http(s) origin).

## Deploy backend

```sh
cd pocketbase
fly launch --no-deploy   # first time: creates the app + volume (fly volumes create pb_data)
fly deploy
```

## Agents (MCP, ADR 0062)

`mcp/` is a remote MCP server: Claude (web, mobile, desktop, Claude Code) or any MCP client connects to
`https://lifeline-mcp.fly.dev/mcp`, the person signs in with their Lifeline email and password on the server's own OAuth
page, and the agent gets tools — `agenda`, `search_documents`, `get_document`, `complete_item`, `move_item`,
`create_document`, `update_document`, plus one tool per headless Command (`tasks_add`, `chores_add`, `calendar_add_event`…).
Each Account's calls run in a worker that is a headless device: Core and the Apps, unchanged, over an in-memory store that
syncs with PocketBase like any phone. It never sees the Private folder and cannot delete.

```sh
pnpm --filter @lifeline/mcp build
node --env-file=mcp/.env mcp/dist/server.mjs     # BASE_URL, PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD, TZ
node mcp/scripts/e2e.mjs http://localhost:8787 <email> <password>   # OAuth + every tool, against a scratch PocketBase
```

Deploy: create a superuser for the server alone in the PocketBase admin UI, then

```sh
fly launch --no-deploy --config mcp/fly.toml      # first time
fly secrets set -a lifeline-mcp PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORD=…
fly deploy . --config mcp/fly.toml
fly scale count 1 -a lifeline-mcp                  # one machine: sign-ins and devices live in its memory
```

In Claude: Settings → Connectors → Add custom connector → the `/mcp` URL. Connected clients are rows of `mcp_grants`;
delete one to disconnect it.

A Command becomes an agent tool by declaring `args` and `invoke` next to its dialog (see `tasks.add`): Core checks the
arguments against the signature, the App runs its own operation. A Schedulable provider is readable by agents once it has
`itemsIn`.

## Adding an App (ADR 0003)

1. New package under `apps/<name>` exporting an `AppManifest` — collections, screens, cards, commands, contract implementations (`schedulable` for work that lands on days, `timed` for fixed-time things).
2. Add the collections to a new `pocketbase/pb_migrations` file (server routes go in `pocketbase/pb_hooks`, loaded with `--hooksDir`) (same base fields: `id` 15-char, `updatedAt` text, `deleted` number, autodates).
3. Register the manifest in `shell/src/main.tsx` (`initApps([...])`) and in `mcp/src/apps.ts`, add the package to `shell/package.json` and `mcp/package.json`, add its `src` to the `@source` list in `shell/src/index.css`, and bump `DB_VERSION` in `packages/core/src/data/db.ts` (Dexie needs it to migrate existing local databases).

Everything else — offline storage, sync, palette entries, card picker, calendar presence — comes from Core.

Cards (ADR 0008): a `CardDef` may declare a `settings` schema (`number` / `select` / `entity` / `tags`) and an
`instanceTitle`; the component receives `{ settings, configure }`. Cards with a required `entity` field are
configured in the picker before being added; the rest get a gear in edit mode. When a configured target is
gone, render `<CardUnavailable onConfigure={configure} />` — the instance stays on the Screen.

Tags (ADR 0014): every top-level entity carries `tags: string[]` (Notes derive theirs from `#tags` in prose and a
frontmatter `tags` list). An App stamps `tags` on the items its Contract providers emit and implements `taggable`
(`useTagged()` → its tagged entities) so Core can derive the vocabulary. Listing Cards set `tagFilterable: true`
and read `useTagFilter()`; the Screen's filter ∧ the instance's `tags` setting compose (any-of within a set, both must pass).

## History

What was built, in what order and why, is the ADR sequence in `docs/adr/` — read it numerically.
