# Shipping

How work gets from a branch to master in this repository. Written by `/ship:setup-ship`; the
`ship` plugin's skills (`pr-review`, `night-shift`) read it. Keep it true when the process changes.

## The rule

A PR reaches `master` only after a person has reviewed it and added the **`ship`** label.
Nothing else merges: the `ship` commit status is required by the ruleset on `master`, and it stays
pending until the label is on.

1. An agent opens the PR as a **draft** while it works.
2. It marks the PR ready only when local checks pass, `/ship:pr-review` has run (label `pr-reviewed`) and the
   review section is in the description.
3. You read the review section, and add `ship` or leave a comment.
4. `.github/workflows/ship.yml` lands it: its `land` job batches the green, labelled PRs through `pnpm integrate` (ADR 0096), and GitHub auto-merges the integration PR once its checks pass (ADR 0126).

Dependabot patch updates and GitHub Actions updates get `ship` without review.

Not even a hotfix merges directly: give it `ship`, and start the Ship workflow by hand if it can't wait two hours.

## Landing

- **Mode:** `command`: `node scripts/integrate.mjs <pr>...` (what `pnpm integrate` runs)
- **Merge method:** merge commit, never squash
- **When:** every two hours (`17 */2 * * *` UTC), whenever a PR gets `ship`, and by hand (Actions → Ship → Run workflow).
- **What:** every open, non-draft PR labelled `ship` whose checks are all green. They're merged into `integration/<date>[-N]` off master, which opens one PR.
- **Never two batches:** the job does nothing while an `integration/*` PR is open. The next run takes what's left.
- **The integration PR** runs the unit checks and the whole e2e suite once, then auto-merges with a merge commit.
  - When it goes red, run `pnpm integrate --drop <pr>` in a worktree, or fix the PR at fault.
  - An ADR number clash stops `integrate`, and the job fails. Renumber the ADR (CLAUDE.md), commit, and run `pnpm integrate --continue`.
- **Contract the command keeps:** it takes PR numbers, lands them through a PR whose head starts with `integration/`, and skips conflicting PRs for the next batch.

## Checks

Required on `master`: `check`, `e2e` (one result for every e2e shard), `dependency-review`, and `ship`.

Run locally before marking a PR ready: `pnpm check` (foreground, 600000 ms timeout), plus the e2e specs the change touches with `pnpm test:e2e:quiet`, and `screens.spec.ts` for a change to a screen (`shell/e2e/README.md`).

## After merge

A merge to master deploys:
- **The shell:** Vercel (`lifeline-shell`, through its GitHub app).
- **PocketBase and the MCP server:** Fly, through the `deploy-pb` and `deploy-mcp` jobs in `check.yml`, each only when its code changed. These run on master's push, which is why the merge must come from `SHIP_TOKEN`, not GitHub's default token.

## Screens

Command that produces screenshots of the screens a change touches, for the review section: none yet. `screens.spec.ts` checks layouts but doesn't save images for the review.

## Spec labels

Specs are GitHub issues moving through `spec:draft` → `spec:ready` → `spec:building` → `spec:in-review`, or
`spec:stuck`, and close when their PR ships.
