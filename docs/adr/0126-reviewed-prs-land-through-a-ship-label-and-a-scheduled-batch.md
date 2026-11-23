---
status: superseded
amends: ADR 0096 (in part — who starts a batch and who merges it)
superseded-by: ADR 0132
---

# Reviewed PRs land through a ship label and a scheduled batch

Under ADR 0096 a batch landed only when someone ran `pnpm integrate` and then merged the integration PR. Nobody ran it from 25 October to 15 November. Green PRs waited days (#387: 104 hours after its last green run), and nine PRs were merged straight to master, skipping the gate. The slow part was the human trigger, not CI: an integration run takes about 22 minutes. Most PRs also waited for review, which nothing on GitHub recorded.

**A label is the review.** A person reads a PR's review section (written by `pr-review`) and adds the `ship` label. That label is the only human step between a finished PR and master. Dependabot patch and GitHub Actions updates get it without review.

**A required `ship` status keeps unreviewed work off master.** `.github/workflows/ship.yml` sets a commit status named `ship`:
- pending, "Waiting for review", until the label is on
- success on an `integration/*` branch, whose PRs were all labelled

The master ruleset requires a pull request, plus `check`, `e2e`, `dependency-review` and `ship`. So no PR merges to master without review and a green batch, including by hand. `e2e` is a small job in `check.yml` that passes only when every planned shard passed, because the shards' own names change with their count.

**Batching stays, but it starts itself.** The `land` job runs `node scripts/integrate.mjs` with every open, green, non-draft PR labelled `ship`:
- every two hours
- whenever a PR gets the label
- when started by hand

It does nothing while an `integration/*` PR is open, so the same PR is never in two batches. Everything else in ADR 0096 holds:
- merge commits, never squash
- migrations are renumbered, and an ADR clash stops the script for an agent to fix
- `--drop` rebuilds a red batch without the PR at fault

**The integration PR merges itself.** `ship.yml` turns on GitHub auto-merge, with a merge commit, for `integration/*` PRs. GitHub then merges the batch once its required checks pass. This replaces ADR 0096's "the script never merges to master": a merge still deploys, but the deliberate act is now the review label on each PR, not a click on the batch.

Writes that must start other workflows (the integration PR's CI, the deploy after a merge) use the `SHIP_TOKEN` secret, a fine-grained token. GitHub's default token doesn't start workflows. The rules for people and agents are in `docs/agents/shipping.md`.
