---
status: accepted
---

# PRs land on master in batches through an integration branch, gated by one full CI run

Landing several PRs one at a time cost one CI run each, back to back. Merging a PR made the next one stale; merging master into it (and renumbering its ADRs and migrations) re-ran its checks, and `e2e-changed` alone took about 27 minutes. Nothing on GitHub forced the re-runs: the master ruleset requires no status check. The waiting was our habit.

**PRs land in batches.** `pnpm integrate [<pr>...]` makes `integration/<date>` off master and merges each PR into it (by default every open, green, non-draft PR, oldest first). It skips a PR that conflicts, renumbers a clashing migration in a commit of its own, and stops on an ADR number taken twice for an agent to fix by hand. Then it opens one PR. That PR lands with a merge commit, never squash, so each original PR's commits reach master and GitHub marks those PRs merged.

**The integration PR is the gate.** A PR runs its CI once, for feedback, and is not refreshed against master afterwards. The integration PR runs the unit checks and the **whole e2e suite once, on four runners**. That is the only run that sees the batch's PRs together. When it fails, the failing case usually names the PR at fault. `pnpm integrate --drop <pr>` rebuilds the branch without that PR, and the failure goes back to it. Nothing bisects automatically.

**The script never merges to master.** A merge to master deploys, so it stays one deliberate act by the user or the orchestrating agent.

**The e2e suite is sharded.** The nightly run and the integration PR split it across four runners (Playwright `--shard`; each shard runs the setup projects it needs). `e2e-changed` on an ordinary PR shards only past 150 cases. Below that, the three minutes of setup each runner pays cost more than they save.

## Considered options

- **GitHub's merge queue**: it does the same batching, and splits a failed batch to find the PR at fault on its own. It is not available here: it needs a repository owned by an organization, and this one belongs to a user. It is the way up if batches get large or frequent enough that dropping PRs by hand hurts. That means moving the repository to a free organization, requiring the queue in the ruleset, and adding `merge_group:` to `check.yml`.
- **Requiring each PR to be up to date with master before it merges**: rejected. That is the serial waiting this decision removes.
- **Squash-merging the integration PR**: rejected. The original PRs would stay open, and their history would be lost.
- **Running only the batch's changed specs on the integration PR**: rejected. Each PR has already run its own specs three times. What only the batch can catch is one PR breaking another's screens, and only the whole suite sees that.
