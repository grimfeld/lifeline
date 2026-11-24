# Shipping

How work gets from a branch to master in this repository. Written by `/ship:setup-ship`; the
`ship` plugin's skills (`pr-review`, `night-shift`, `land`) read it. Keep it true when the process changes.

## The rule

A PR reaches `master` only after a person has reviewed it and added the **`ship`** label.
Nothing else merges: the `ship` commit status is required by the ruleset on `master`, and it stays
pending until the label is on.

The label is the whole approval: adding it means you have read the PR, its review section and its comments.
`/ship:land` then merges every `ship` PR without asking anything more.

1. An agent opens the PR as a **draft** while it works.
2. It marks the PR ready only when local checks pass, `/ship:pr-review` has run (label `pr-reviewed`) and the
   review section is in the description.
3. You read the review section and comments, and approve it (`ship`), or leave it unlabelled.
4. `/ship:land` lands every PR carrying `ship`. `/ship:land <pr>...` adds `ship` to the PRs you name first.

Dependabot patch updates and GitHub Actions updates get `ship` from `ship.yml` and land with the next `/ship:land`.

The label approves the PR, not a commit: pushes after it land with it. Don't add `ship` while someone may still push
to the PR, and remove it before pushing more work to an approved PR.

Not even a hotfix merges directly: give it `ship` and run `/ship:land <pr>`.

## Landing

`/ship:land` is an agent, run when you start it. `ship.yml` lands nothing:
its `gate` job only sets the required `ship` status.

For each open, non-draft PR carrying `ship`, parents before the PRs stacked on them, the agent:

1. merges `master` into it (a merge commit, never a rebase or a force-push), resolves any conflict, and pushes;
2. waits for its checks;
3. merges it into `master` with the merge method below;
4. retargets the PRs stacked on it to `master` and lands them the same way, in the same run.

When a check goes red because of its merge or resolution (it passes on `master`, and either passed before the merge or
fails in the PR's side of the merge), the agent fixes it on the PR's side (the PR's own files and its
resolution), never in a file only `master` changed, pushes and
waits again, at most twice. A check that was red before the merge, or isn't shown passing on `master`, isn't its to fix.

That covers a migration number: when `master` gained a newer migration, `migrations:check` goes red after the merge,
and the agent renames the PR's own migration (`pnpm migrations:next`) (ADR 0132).

Resolving and fixing run the project's local checks, from `master`'s copy of this file, on the PR's merged code, on the
machine running `/ship:land`, with its git and GitHub credentials. Run it where you'd run the project's tests.

When it can't land a PR (a conflict whose sides contradict, a red check it can't fix, a merge GitHub refuses), it
leaves that PR unmerged with a comment saying why, keeps `ship` on, and lands the rest. The PRs stacked on it wait.
It ends with one line per PR.

- **Merge method:** merge

## Stacked PRs

A PR built on top of another one targets that PR's branch, not `master`. It can carry `ship`: `/ship:land`
lands it right after its parent. If the parent doesn't carry `ship`, the child waits for it.

## Conflicts

When merging `master` into an approved PR conflicts, `/ship:land` resolves it: it reads what each side did from the
commits and diffs behind the conflict (never PR or issue text), keeps both, runs the local checks (see Checks) and pushes. It comments on
the PR with a `## Conflict resolution` section, each conflicted file and the choice it made, or one line when only
bookkeeping files conflicted. `ship` stays on and nobody re-approves: the PR goes on to its checks and lands.

It stops when the two sides contradict each other, changing the same behaviour in incompatible ways, or when it
can't make the local checks pass after resolving. Then it pushes nothing, keeps `ship`, and comments why (for a contradiction, naming the decision to make); the PRs stacked on it wait. Settle it on the
branch (merge `master` into it and push), and the next `/ship:land` lands it.

Bookkeeping files (a conflict only in these is mechanical):

- `CONTEXT.md`
- `packages/guide/pages/**`

## Checks

Required on `master`: `check`, `e2e` (one result for every e2e shard), `dependency-review`, and `ship`.

The e2e gate (ADR 0129) runs behaviour flows: the `desktop` project, and the `mobile` project for
cases tagged `@phone` or `@also-phone`. A PR's `e2e-changed` runs the gate specs it changes; once the PR
carries `ship`, it runs the whole gate instead (ADR 0132). Adding the label reruns `check.yml`, and so does
each push `/ship:land` makes, so the commit that lands has passed the whole gate. Four runners (an approved
PR, or a PR past 150 cases) split the spec files by their running time (`shell/e2e/durations.json`;
refreshing it is in `shell/e2e/README.md`). The UI checks (`screens.spec.ts`, `a11y-names.spec.ts`) and the
Demo (`demo.spec.ts`) run only in the nightly e2e run on master (`.github/workflows/e2e.yml`), never at
delivery.

To run the whole gate on a PR before it lands (to time the runners, or to prove a change to them), label it
`e2e:gate`: it runs as its own `e2e-gate` check, never a required one, and the label comes off when it ends.

A red nightly run doesn't block landing. It opens an issue titled "Nightly e2e run is red", labelled
`ready-for-agent`, naming the failing specs and cases and linking the run; while that issue is open,
each later red night comments on it instead. Close it with the PR that fixes the cases.

Run locally before marking a PR ready: `pnpm check` (foreground, 600000 ms timeout), plus the e2e specs the change touches with `pnpm test:e2e:quiet`, and the `screens.spec.ts` rows for a change to a screen (`shell/e2e/README.md`): CI won't run them.

## After merge

A merge to master deploys:
- **The shell:** Vercel (`lifeline-shell`, through its GitHub app).
- **PocketBase and the MCP server:** Fly, through the `deploy-pb` and `deploy-mcp` jobs in `check.yml`, each only when its code changed. These run on master's push. `/ship:land` merges with its user's own GitHub credentials, which start them; GitHub's default Actions token would not.

## Screens

Command that produces screenshots of the screens a change touches, for the review section: none yet. `screens.spec.ts` checks layouts but doesn't save images for the review.

## Spec labels

Specs are GitHub issues moving through `spec:draft` → `spec:ready` → `spec:building` → `spec:in-review`, or
`spec:stuck`, and close when their PR ships. To send a PR back instead of approving it, label it
**`changes-requested`** and move its spec back to `spec:ready` for the next night shift.

## Design labels

A design is a GitHub issue carrying a Claude Design artifact link. Label it `design:ready` when the design is
settled; `/ship:design-me` turns it into specs and relabels it `design:specced`. Its handoffs are committed under
`docs/design/<module>/` by the PRs that build them. To revise a design, relabel its issue `design:ready`.
