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
                 one-time + weekly/monthly/yearly recurring tasks, per-Occurrence complete/move, Unassigned pool
apps/calendar    @lifeline/app-calendar — Calendar App: Events (timed / all-day / multi-day),
                 shown on the month, week and Today surfaces via the Timed contract; Event templates (quick add onto a
                 slot) and Time blockers (recurring bands painted behind the Schedule), ADR 0027
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
                 View/Document/Count cards, sidebar, command palette (Ctrl+K),
                 user Screens (drag/resize card grids), calendar + week + schedule (hour-scaled time-blocking, ADR 0015) + map Surfaces; Tauri 2 desktop config
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

## Deploy backend

```sh
cd pocketbase
fly launch --no-deploy   # first time: creates the app + volume (fly volumes create pb_data)
fly deploy
```

## Adding an App (ADR 0003)

1. New package under `apps/<name>` exporting an `AppManifest` — collections, screens, cards, commands, contract implementations (`schedulable` for work that lands on days, `timed` for fixed-time things).
2. Add the collections to a new `pocketbase/pb_migrations` file (server routes go in `pocketbase/pb_hooks`, loaded with `--hooksDir`) (same base fields: `id` 15-char, `updatedAt` text, `deleted` number, autodates).
3. Register the manifest in `shell/src/main.tsx` (`initApps([...])`), add the package to `shell/package.json`, add its `src` to the `@source` list in `shell/src/index.css`, and bump `DB_VERSION` in `packages/core/src/data/db.ts` (Dexie needs it to migrate existing local databases).

Everything else — offline storage, sync, palette entries, card picker, calendar presence — comes from Core.

Cards (ADR 0008): a `CardDef` may declare a `settings` schema (`number` / `select` / `entity` / `tags`) and an
`instanceTitle`; the component receives `{ settings, configure }`. Cards with a required `entity` field are
configured in the picker before being added; the rest get a gear in edit mode. When a configured target is
gone, render `<CardUnavailable onConfigure={configure} />` — the instance stays on the Screen.

Tags (ADR 0014): every top-level entity carries `tags: string[]` (Notes derive theirs from `#tags` in prose and a
frontmatter `tags` list). An App stamps `tags` on the items its Contract providers emit and implements `taggable`
(`useTagged()` → its tagged entities) so Core can derive the vocabulary. Listing Cards set `tagFilterable: true`
and read `useTagFilter()`; the Screen's filter ∧ the instance's `tags` setting compose (any-of within a set, both must pass).

## Roadmap (agreed build order)

1. ✅ Tracer bullet: Core + Chores + calendar Surface + Screens + palette
2. ✅ Tasks App (absorbs calendar tasks + week-planner; per-Occurrence recurrence) + week Surface
   with drag & drop and an Unplaced pool; Schedulable gained an App-owned `move` hook (ADR 0004)
3. ✅ Calendar Events: Calendar App owning Events, rendered on the month/week/Today surfaces through
   a second Core contract, `Timed` (fixed-time, not completable — ADR 0005)
4. ✅ Stats (notch port — ADR 0007) and Media (nightstand port generalised to any medium — ADR 0006)
5. ◐ Retire the legacy backends — importers in `scripts/import/` + runbook in `docs/retire-legacy.md`;
   the deploy → import → verify → `fly apps destroy` steps are manual (see the runbook for what was found)
6. ✅ Notes App + Journal (ADR 0009/0010): Notes engine, Linkable + Daylog contracts implemented by every App,
   Obsidian vault importer (`pnpm import:obsidian`, see docs/retire-legacy.md)
7. ✅ Map Surface (ADR 0011): Locatable contract (coordinates only, geocoded at edit time via Nominatim),
   Leaflet over OSM tiles — `/map` screen, Map card, mini-map on Place notes; Notes is the first provider
8. ✅ Tags (ADR 0014): free-form tags on every App entity, Taggable contract, Screen/Card Tag filters, Tags card
9. ✅ Sources App (ADR 0016): external content as App-owned entities; Embed kind (iframe + Open ↗), Embed card
10. ✅ Feeds, Calendar subscriptions, Live values (ADR 0017): one Core `fetchExternal` (Tauri http, else the PocketBase
    `/api/lifeline/fetch` proxy in `pocketbase/pb_hooks`), local-only `_source_cache`, ical.js expansion
