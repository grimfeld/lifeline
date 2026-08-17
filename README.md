# Lifeline

Personal dashboard/OS: one shell hosting sovereign Apps that interoperate through Contracts. See `CONTEXT.md` for the ubiquitous language and `docs/adr/` for the decisions.

## Layout

```
packages/core    @lifeline/core — contracts, app registry, Dexie offline store + PocketBase sync engine
packages/ui      @lifeline/ui — shared shadcn/Tailwind component kit (unified look)
apps/chores      @lifeline/app-chores — first App (ported from chore-scheduler)
apps/tasks       @lifeline/app-tasks — Tasks App (absorbs week-planner + calendar's task half):
                 one-time + weekly-recurring tasks, per-Occurrence complete/move, Unassigned pool
apps/calendar    @lifeline/app-calendar — Calendar App: Events (timed / all-day / multi-day),
                 shown on the month, week and Today surfaces via the Timed contract
apps/stats       @lifeline/app-stats — Stats App (notch port): additive / measurement / boolean /
                 collection stats, entries as an event log, derived totals, streaks, Recharts graphs
apps/notes       @lifeline/app-notes — Notes App (Obsidian-style, ADR 0009): markdown notes with typed Note types
                 (built-in daily/person/place/plain + user-defined types & templates), wikilinks + backlinks across notes and other Apps' entities (Linkable),
                 CodeMirror 6 editor, `daylog` blocks (Daylog contract), the Journal Surface; conflict copies (ADR 0010);
                 notes with a `location: [lat, lon]` property are Pins on the map (Locatable, ADR 0011)
apps/media       @lifeline/app-media — Media App (nightstand port, generalised): books, comics, movies,
                 series, albums, games on two axes (Acquisition × Engagement) with per-medium Nightstand slots
shell            @lifeline/shell — Vite + React shell: sidebar, command palette (Ctrl+K),
                 user Screens (drag/resize card grids), calendar + week + map Surfaces; Tauri 2 desktop config
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
2. Add the collections to a new `pocketbase/pb_migrations` file (same base fields: `id` 15-char, `updatedAt` text, `deleted` number, autodates).
3. Register the manifest in `shell/src/main.tsx` (`initApps([...])`), add the package to `shell/package.json`, add its `src` to the `@source` list in `shell/src/index.css`, and bump `DB_VERSION` in `packages/core/src/data/db.ts` (Dexie needs it to migrate existing local databases).

Everything else — offline storage, sync, palette entries, card picker, calendar presence — comes from Core.

Cards (ADR 0008): a `CardDef` may declare a `settings` schema (`number` / `select` / `entity`) and an
`instanceTitle`; the component receives `{ settings, configure }`. Cards with a required `entity` field are
configured in the picker before being added; the rest get a gear in edit mode. When a configured target is
gone, render `<CardUnavailable onConfigure={configure} />` — the instance stays on the Screen.

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
