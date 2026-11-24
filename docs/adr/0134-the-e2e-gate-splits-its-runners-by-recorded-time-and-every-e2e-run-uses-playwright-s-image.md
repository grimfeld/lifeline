---
status: accepted
amends: ADR 0132 (in part — how the whole gate's four runners are split, and the image every e2e run uses)
---

# The e2e gate splits its runners by recorded time, and every e2e run uses Playwright's image

## Context

ADR 0096 split the integration PR's whole e2e gate across four runners with Playwright's `--shard`, which gives each
runner the same number of cases in file order. The slow spec files sit together in the alphabet, so one runner
finished up to six minutes after the others (#564). Each runner also installed Chromium's libraries with apt, which
took anywhere from 15 s to 6 min. ADR 0132 moved the whole gate onto each approved PR and kept its four runners
without saying how they are split.

## Decision

The gate's four runners (an approved PR, a PR past 150 changed cases, a manual gate run) split the spec files by
their recorded running time, `shell/e2e/durations.json`, slowest first, each to the runner with the least work
(`scripts/e2e-shards.mjs`). The nightly run keeps `--shard`, since it also runs projects with no recorded times (the
UI checks and the Demo). Every e2e run, gate and nightly, runs in `mcr.microsoft.com/playwright` at
`@playwright/test`'s exact version from `shell/package.json`, which holds the browser and its libraries.

## Consequences

- The four runners finish within a minute of each other (0.2 min apart on the first whole-gate run after the
  change), and the gate takes about 6–7 min.
- The gate and the nightly run test in the same OS image, so a case can't pass at delivery and fail nightly on fonts
  or libraries alone.
- A spec file is never split between runners: one that nears a quarter of the gate's case time holds its runner up
  and should be split.
- The recorded times go stale as specs change; a file with none counts as the median time per case.
