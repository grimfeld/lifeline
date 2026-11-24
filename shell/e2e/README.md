# E2E tests

Two kinds of case live here (ADR 0129):

- **The delivery gate** proves user flows work. A PR runs the gate specs it changes, and a PR
  carrying `ship` runs the whole gate (ADR 0132). Logic (rules, variants, edge cases) belongs in unit
  tests next to the code, not here.
- **The nightly checks** run only on master each night (`.github/workflows/e2e.yml`): the
  layout test `screens.spec.ts` (every screen over the longest content a person could type,
  ADR 0065), `a11y-names.spec.ts`, and the Demo (`demo.spec.ts`). CI never runs them for a
  PR, so run the rows you touched before pushing.

| Project | Runs | When |
|---|---|---|
| `desktop` (1280px) | every gate case except those tagged `@phone` | delivery, nightly |
| `mobile` (360px) | gate cases tagged `@phone` or `@also-phone` | delivery, nightly |
| `nightly-desktop`, `nightly-mobile` | `screens.spec.ts`, `a11y-names.spec.ts`, every case at its width | nightly |
| `demo` (with `demo-setup`) | `demo.spec.ts`, widths set per case | nightly |

```sh
pnpm test:e2e                                                          # everything, from the repo root
pnpm --filter @lifeline/shell test:e2e --project=desktop --project=mobile  # the delivery gate
pnpm --filter @lifeline/shell test:e2e --project=nightly-mobile -g Tasks   # one screen's layout, one width
pnpm --filter @lifeline/shell test:e2e --only-changed=origin/master    # the specs your branch changes
pnpm test:e2e:quiet --project=desktop people.spec.ts                    # dot reporter, for agents
```

No `--` before the flags: pnpm would hand it to Playwright, which then reads them as
file filters. A PR runs only the gate specs it changes, three times each
(`.github/workflows/check.yml`, `e2e-changed`), or once on four runners past 150 cases. The
whole gate runs on every PR carrying `ship` (ADR 0132), and everything runs on
master each night; each runner runs the setup projects its cases need. A red nightly run opens
(or comments on) a `ready-for-agent` issue naming the failing cases (`scripts/e2e-failures.mjs`).

### The four runners

The nightly run splits the suite four ways with `--shard`. A PR's four runners instead split
the spec files by how long each takes, from `e2e/durations.json`
(`scripts/e2e-shards.mjs`): `--shard` splits by count, in file order, so slow files next to
each other in the alphabet land on one runner. A file is never split between runners, so one
that nears a quarter of the gate's case time (about 7 min, both widths together) holds its
runner up: split it.
A new spec needs no entry; it counts as the median time a case. When the runners drift more
than a minute or two apart, refresh the times from an approved PR's run reports:

```sh
gh run download <run-id> --pattern 'e2e-results-*' --dir /tmp/e2e-results
node scripts/e2e-shards.mjs durations /tmp/e2e-results/*/e2e-results.json > shell/e2e/durations.json
```

To time the four runners on a branch before it lands, run the Check workflow by hand
(Actions → Check → Run workflow) with **gate** ticked: it runs the whole gate as an
approved PR does.

### A CI runner, locally

To run one CI runner's cases in the image CI uses (`mcr.microsoft.com/playwright`, at
`@playwright/test`'s version in `shell/package.json`), from the worktree's root. A cloud
container has Docker installed, but its daemon isn't running, and a container reaches the
network only through the session's proxy and trusts its CA only when told. A laptop's Docker
Desktop needs none of the proxy steps: drop the proxy variables and the CA bundle.

```sh
# The daemon, in the background, then wait for it to answer.
(dockerd > /tmp/dockerd.log 2>&1 &)
timeout 60 sh -c 'until docker info > /dev/null 2>&1; do sleep 1; done'

# The gate's image (dockerd pulls through the session's proxy).
PW=$(node -p "require('./shell/package.json').devDependencies['@playwright/test'].replace(/^[\\^~]/, '')")
docker pull mcr.microsoft.com/playwright:v$PW-noble

# A fresh clone of the branch's commits (not uncommitted work) to mount into the container.
rm -rf /tmp/e2e-runner && git clone -q --branch "$(git branch --show-current)" "$PWD" /tmp/e2e-runner

# Runner 2 of 4's files, planned as check.yml plans them.
(cd shell && pnpm exec playwright test --list --reporter=json --project=desktop --project=mobile) > /tmp/e2e-list.json
node scripts/e2e-shards.mjs plan 4 /tmp/e2e-list.json shell/e2e/durations.json > /tmp/e2e-plan.json
FILES=$(node -p "require('/tmp/e2e-plan.json').include[1].files")

# The runner: host network for the proxy, the CA bundle for Node, pnpm (the image has none).
docker run --rm --network host --ipc=host \
  -e CI=1 -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e https_proxy -e http_proxy -e no_proxy \
  -e NODE_EXTRA_CA_CERTS=/ca.crt -v /root/.ccr/ca-bundle.crt:/ca.crt:ro \
  -e FILES="$FILES" -e PNPM="$(node -p "require('./package.json').packageManager")" \
  -v /tmp/e2e-runner:/work -w /work \
  mcr.microsoft.com/playwright:v$PW-noble \
  bash -c 'npm i -g "$PNPM" && pnpm install --frozen-lockfile && cd shell && pnpm exec playwright test $FILES --project=desktop --project=mobile --reporter=dot'
```

The container runs the fresh clone, never the worktree: its `pnpm install` writes Linux
`node_modules` for the image, and on the worktree it would overwrite the ones your own runs
use. `include[0]` to `include[3]` are the four runners; `plan 1` gives the whole gate on one.

## Widths

A gate case runs at desktop width. A case whose flow differs on the phone carries a tag:

```ts
test("on a phone, Add household sits in the Phone dock", { tag: "@phone" }, async ({ page }) => { … });   // phone only
test("an empty hour opens the Event dialog", { tag: "@also-phone" }, async ({ page, isMobile }) => { … }); // both widths
test.describe("Vault · the phone drawer", { tag: "@phone" }, () => { … });                                 // a whole describe
```

Never pick a width with `test.skip(isMobile)`, `!isMobile` or a viewport check:
`scripts/e2e-widths.test.mjs` fails on it in a gate spec. Inside an `@also-phone` case,
`isMobile` may still choose how to act (a tap or a click). The nightly specs set their widths
themselves and are exempt.

Each run starts its own servers on the first free three ports from 1421 on (1421, 1424,
1427…), so runs in several worktrees at once don't collide; `E2E_PORT` picks the first of
the three instead.

Runs also share the machine's memory: each starts its own Vite server (about 1.1 GB) and a
Chromium per worker. So a run takes a slot before its servers start, one slot per 5 GB of
memory (three on a 15 GB container). When every slot is taken, it names the runs that hold them
(worktree and process id) and waits for one to finish. A run that crashes or is killed frees
its slot for the next taker. `E2E_SLOTS=<n>` sets the count, and `E2E_SLOTS=0` turns the limit
off. CI and `--list` never take one. The locks are files in the temp directory
(`lifeline-e2e-slots-<uid>/`).

In a cloud container the config launches the Chromium in
`/opt/pw-browsers` on its own, whatever build it is: never run `playwright install` there,
and never change that directory. The two Demo builds start only when the run includes the `demo` or
`demo-setup` project (no `--project` at all, or one of those).

- Import `test` from `./support/test`, never from `@playwright/test`: every page load then starts a new desk, so a `goto` lands as the one maximised Window, as a whole page did before the Hub (ADR 0133). Only `hub.spec.ts` keeps the saved window layout, because that is what it tests.
- Open the command palette with `openPalette(page)` from `support/palette.ts`, never a bare key press: it waits for a closing palette, then for the input. Press `Control` (editor chords: `pressMod` in `support/keys.ts`), never `ControlOrMeta` (the `desktop` project is a Windows user agent; `scripts/e2e-keys.test.mjs` checks).
- `seed.setup.ts` runs first: `support/seed.ts` runs every headless Command,
  gives every Document type a Document with every Field filled, and places
  every Card on one Screen — all read from the registry, so new types, Fields,
  Commands and Cards are covered without editing anything. The seeded IndexedDB
  is saved to `.auth/seeded.json` and loaded by every test.
  - `support/seed.ts` is the only data the layout cases see; the Demo life
    (`src/demo/life/`) is not loaded.
  - It fills what headless Commands set. A Field no Command sets, such as a links
    Field like With or For, stays empty.
  - To show one, patch it in the row's `afterOpen`; `peekWithPerson` in
    `screens.spec.ts` is the pattern.
- Before `evaluate` / `evaluateAll` (they read the DOM once, without waiting), wait with a
  web-first assertion (`await expect(…).toBeVisible()`, `toHaveCount(n)`) for every element
  the read depends on. Prefer an assertion such as `toHaveText([...])` over a raw read when
  it can say the same thing.
- A wait or assertion on something the test created targets that thing's exact accessible
  name (`exact: true`), built from the data the test used:
  `getByRole("button", { name: `Remove ${personTitle}`, exact: true })`. A pattern
  (`/^Remove /`) also matches neighbouring controls that seeded data adds, such as a Tag
  chip's `Remove tag …`.
- `screens.spec.ts` (nightly) lists the screens (`SCREENS`). **Add a row for every new
  screen**; the last test fails when a registered screen has none.
- `support/layout.ts` is the check. It reports:
  - `spill` — text drawn outside a box that contains it,
  - `cut` — text clipped sideways without an ellipsis,
  - `stray-scroll` — a box scrolling sideways that did not ask to
    (`overflow-x-auto` / `data-scroll-x` mark the ones that do).

  Text that overhangs its box on purpose opts out with `data-layout-ignore`
  (and a comment saying why).
- Each screen also gets an axe scan, limited to the `label` and `aria-valid-attr-value` rules: every form control has an accessible name, and its ARIA attributes (an `aria-describedby` naming a hint, say) point at something real.

  Each line names the element whose text is out of place and the box it left.
  The element at fault is often a sibling: a long label without `min-w-0`
  pushing the count or button next to it out of the row.

## The Demo

`demo.spec.ts` runs nightly in its own `demo` project, against a production build of
the Demo (`vite build` with `VITE_DEMO=1`, served by `vite preview` on
the port after the app's, 1422 by default) — never the layout seed. Each case runs at
phone (360px) and desktop (1280px) width. Run it before pushing a change that
touches the Demo or the shell's sign-in and sync surfaces (ADR 0077). The
Source link cases use a second build on the port after that, with
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
- The suite's Demo build (the first, built with `VITE_DEMO_E2E=1`) hands
  it the App registry on `window.lifelineDemo` (`src/demo/inspect.ts`): the
  bundle cannot be imported from a test. The deployed Demo, like the Source-link
  build, has no such hook.
- Pages are read in `en-IE`, whatever the machine's locale.
- The project runs 2 workers, 30 seconds per case; the whole of it takes about
  4 minutes. One case logs the first-open time.

While iterating, run only your own cases, at one width; run the whole `demo`
project once before reporting or merging:

```sh
pnpm --filter @lifeline/shell test:e2e --project=demo -g "Demo media at phone"  # yours, one width
pnpm --filter @lifeline/shell test:e2e --project=demo                          # all, once
```

Every server is started fresh, never reused: another checkout's server would
serve other code.
