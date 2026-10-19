# Layout tests

Every screen, at phone (`mobile`, 360px) and desktop (`desktop`, 1280px) width,
over a store filled with the longest content a person could type (ADR 0065).

```sh
pnpm test:e2e                                                      # from the repo root
pnpm --filter @lifeline/shell test:e2e -- --project=mobile -g Tasks  # one screen, one width
```

It is not in CI (about 13 minutes for both widths): run it locally before
pushing a change that touches a screen.

- `seed.setup.ts` runs first: `support/seed.ts` runs every headless Command,
  gives every Document type a Document with every Field filled, and places
  every Card on one Screen — all read from the registry, so new types, Fields,
  Commands and Cards are covered without editing anything. The seeded IndexedDB
  is saved to `.auth/seeded.json` and loaded by every test.
- `screens.spec.ts` lists the screens (`SCREENS`). **Add a row for every new
  screen**; the last test fails when a registered screen has none.
- `support/layout.ts` is the check. It reports:
  - `spill` — text drawn outside a box that contains it,
  - `cut` — text clipped sideways without an ellipsis,
  - `stray-scroll` — a box scrolling sideways that did not ask to
    (`overflow-x-auto` / `data-scroll-x` mark the ones that do).

  Text that overhangs its box on purpose opts out with `data-layout-ignore`
  (and a comment saying why).

  Each line names the element whose text is out of place and the box it left.
  The element at fault is often a sibling: a long label without `min-w-0`
  pushing the count or button next to it out of the row.

## The Demo

`demo.spec.ts` runs in its own `demo` project, against a production build of
the Demo (`vite build` with `VITE_DEMO=1`, served by `vite preview` on
`E2E_PORT + 1`, 1422 by default) — never the layout seed. Each case runs at
phone (360px) and desktop (1280px) width. Run it before pushing a change that
touches the Demo or the shell's sign-in and sync surfaces (ADR 0077). The
Source link cases use a second build on `E2E_PORT + 2`, with
`VITE_DEMO_SOURCE_URL` set (another origin, so its cases start from an empty
store and seed the life themselves); the first has none, as the Demo does until the
repository is public. Both builds take about half a minute before any case runs.

- `demo.setup.ts` (the `demo-setup` project) opens the Demo once, lets it seed
  its life and saves the store (IndexedDB included) to `.auth/demo.json`. Every
  `demo` case starts from that life, dated on the run's day.
- A case about a stranger's first open, a pinned clock, a reload or Reset needs
  the store empty: put it in a `describe` with `test.use({ storageState: EMPTY })`
  and `test.describe.configure({ timeout: SEEDING })` (60 seconds, 90 on CI,
  where seeding is two to three times slower). It then seeds the life
  itself: Home shows in under a second, the rest is written behind it for about
  ten seconds ("Filling in the rest of the Demo…"), which `open()`/`settle()`
  wait out. Only those: seeding is the slow part.
- The suite's Demo build (on `E2E_PORT + 1`, built with `VITE_DEMO_E2E=1`) hands
  it the App registry on `window.lifelineDemo` (`src/demo/inspect.ts`): the
  bundle cannot be imported from a test. The deployed Demo, like the Source-link
  build, has no such hook.
- Pages are read in `en-IE`, whatever the machine's locale.
- The project runs 2 workers, 30 seconds per case; the whole of it takes about
  4 minutes. One case logs the first-open time.

While iterating, run only your own cases, at one width; run the whole `demo`
project once before reporting or merging. No `--` before the flags:

```sh
E2E_PORT=1701 pnpm --filter @lifeline/shell test:e2e --project=demo -g "Demo media at phone"  # yours, one width
E2E_PORT=1701 pnpm --filter @lifeline/shell test:e2e --project=demo                          # all, once
```

Every server is started fresh, never reused: another checkout's server would
serve other code. Agents side by side each pick their own `E2E_PORT` (it moves
all three servers): check that it and the next two ports are free, and never
take 1421–1423, the default checkout's.
