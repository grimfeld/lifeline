---
status: accepted
supersedes: ADR 0096, ADR 0126
amends: ADR 0129 (in part — the whole gate runs on each approved PR, not on an integration PR)
---

# Approved PRs land one by one through /ship:land, and the full e2e gate runs on each approved PR

ADR 0096 landed PRs in batches through an `integration/<date>` branch, and ADR 0126 started those batches from the
`ship` label and a two-hourly schedule and let the integration PR auto-merge. Version 3 of the `ship` plugin drops
both: `ship.yml` lands nothing, and `/ship:land` is an agent the user runs. Lifeline follows it, and keeps the one
thing batching gave it that nothing else did: the whole e2e gate runs before anything reaches master.

**The label is still the review.** A person adds `ship` to a PR they have read. `ship.yml`'s `gate` job sets the
required `ship` status from it, and its `dependabot` job labels patch and Actions updates. Nothing in the repository
merges on its own: no schedule, no auto-merge.

**`/ship:land` lands each approved PR on its own**, parents before the PRs stacked on them:
- merges master into it (a merge commit), resolving conflicts itself and commenting with its choices
- waits for its checks on that commit
- merges it with a merge commit

A check its merge turned red it fixes on the PR's side, at most twice. That replaces `pnpm integrate`'s migration
renumbering: once master gains a newer migration, `migrations:check` goes red on the merged PR and the agent renames
the PR's own migration. ADR clashes go the same way, by `pnpm adr:mv` on the PR's side. `scripts/integrate.mjs` is
gone.

**The whole gate runs on each approved PR.** `check.yml` also runs on `labeled`, and its e2e plan runs the whole
gate (the ADR 0129 projects, four runners, about five minutes) whenever the PR carries `ship`; without it, a PR
runs only the specs it changes. Adding the label reruns it, and so does each push `/ship:land` makes, so the commit
that merges passed the whole gate with master in it. The required `e2e` check carries the result, as before.

Any label reruns `check.yml`, not just `ship`: a run whose jobs all skip would report `check` and `e2e` as passed on
the required checks, so the cheaper filter isn't safe.

**What it costs.** No run sees several PRs together any more: two approved PRs each pass the gate with the master
they merged, and the second lands after the first changed master, but `/ship:land` merges master into it first and
waits again. Each approved PR pays one full gate run instead of sharing a batch's.

**Rejected:**
- **Keeping batches under version 3** — `/ship:land` refuses to run beside a `ship.yml` that lands PRs, and keeping the
  integration branch meant forking the plugin.
- **A separate gate workflow setting an `e2e-full` commit status** — a second required check and a copy of the
  shard jobs, for what one condition in `check.yml` already does.
- **The whole gate on every PR push** — five minutes on four runners for every push of every draft, to catch what
  only matters at approval.

The rules for people and agents are in `docs/agents/shipping.md`.
