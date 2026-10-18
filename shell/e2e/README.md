# Layout tests

Every screen, at phone (`mobile`, 360px) and desktop (`desktop`, 1280px) width,
over a store filled with the longest content a person could type (ADR 0065).

```sh
pnpm test:e2e                                                      # from the repo root
pnpm --filter @lifeline/shell test:e2e -- --project=mobile -g Tasks  # one screen, one width
```

It is not in CI (about 13 minutes for both widths): run it locally before
pushing a change that touches a screen.

## The Demo

`demo.spec.ts` runs in its own `demo` project, against its own dev server
(port 1422, started with `VITE_DEMO=1`) and a fresh, empty browser store — it
does not use the layout seed. Each case runs at phone (360px) and desktop
(1280px) width. Run it before pushing a change that touches the Demo or the
shell's sign-in and sync surfaces (ADR 0077).

```sh
pnpm --filter @lifeline/shell test:e2e -- --project=demo
```

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
