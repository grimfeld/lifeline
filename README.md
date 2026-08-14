# Lifeline

Personal dashboard/OS: one shell hosting sovereign Apps that interoperate through Contracts. See `CONTEXT.md` for the ubiquitous language and `docs/adr/` for the decisions.

## Layout

```
packages/core    @lifeline/core — contracts, app registry, Dexie offline store + PocketBase sync engine
packages/ui      @lifeline/ui — shared shadcn/Tailwind component kit (unified look)
apps/chores      @lifeline/app-chores — first App (ported from chore-scheduler)
shell            @lifeline/shell — Vite + React shell: sidebar, command palette (Ctrl+K),
                 user Screens (drag/resize card grids), calendar Surface; Tauri 2 desktop config
pocketbase       Dockerfile + fly.toml (app: lifeline-pb) + pb_migrations
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

1. New package under `apps/<name>` exporting an `AppManifest` — collections, screens, cards, commands, contract implementations.
2. Add the collections to a new `pocketbase/pb_migrations` file (same base fields: `id` 15-char, `updatedAt` text, `deleted` number, autodates).
3. Register the manifest in `shell/src/main.tsx` (`initApps([...])`).

Everything else — offline storage, sync, palette entries, card picker, calendar presence — comes from Core.

## Roadmap (agreed build order)

1. ✅ Tracer bullet: Core + Chores + calendar Surface + Screens + palette
2. Tasks App (absorbs calendar tasks + week-planner; per-Occurrence recurrence)
3. Calendar Events + week Surface
4. Stats (notch port), Readlist (nightstand port)
5. Retire the four old Fly PocketBase instances as parity lands
