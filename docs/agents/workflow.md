# Workflow: what to do next

For the user and for agents. Find the line that matches where you are and do what it says.
The why is in `CLAUDE.md` and ADR 0096 (batch landing).

## The path of one change

| You are here | Next |
| --- | --- |
| An idea, no issue | `gh issue create` (see `issue-tracker.md`). Label it `needs-triage`, or `ready-for-agent` if it's fully specified (`triage-labels.md`). |
| An issue to work on | `pnpm worktree:new <name>`, then work in `.claude/worktrees/<name>`. Never work in the main checkout. |
| A behaviour to change | Read `CONTEXT.md` and the ADRs that touch it. A new decision gets `pnpm adr:new "The decision, as a sentence"`. |
| A schema change | `pnpm migrations:next` for the number. Dry-run it on a copy of `pb_data` before merging, because merging deploys it. |
| A screen or UI change | Build from `@lifeline/ui` (`CODING_STANDARDS.md` § UI, § Layout, § Long content). A new screen gets a row in `SCREENS`. |
| Something a user can see | Update its Guide page in the same PR (`packages/guide/AUTHORING.md`). |
| Code written | `pnpm check`. Then run the e2e specs you touched, and `screens.spec.ts` if you changed a screen (`shell/e2e/README.md`). |
| Checks green locally | Commit as `claude@grimfeld.tech`, push, and open the PR (the `pr` skill writes the body). |
| PR's CI red | Fix it on the branch and push. A red **nightly** run means master was already broken, not your change. |
| PR's CI green | **Stop.** Don't merge master into it to refresh CI, and don't merge it alone. It waits for the next batch. |
| Several PRs green | Land them as a batch (below). |
| PR merged | `pnpm worktrees:prune` clears the worktrees whose work is on master. |

## Landing a batch

| You are here | Next |
| --- | --- |
| Green PRs waiting | `pnpm worktree:new integrate`, then `pnpm integrate` in it (all green PRs, oldest first) or `pnpm integrate 241 243` (just those). Add `--no-push` for a local preview. |
| "skip #N: conflicts" | Leave it. Tell PR #N's owner to rebase on master; it joins the next batch. |
| "renumbered …" | Nothing to do: migrations were renumbered automatically, and the PR body lists them. |
| Stopped on an ADR clash | Move the narrower ADR with `pnpm adr:mv`, add `formerly: NNNN`, update its references by meaning (`CLAUDE.md`), commit, then run `pnpm integrate --continue`. |
| Integration PR running | Wait. It runs the unit checks and the whole e2e suite once, on four runners. |
| Integration PR red | Read the failing case and find the PR it points at. `pnpm integrate --drop <pr>` rebuilds the branch without it and re-runs CI. Send the failure back to that PR. |
| Integration PR green | Merge with a merge commit, never squash: `gh api -X PUT repos/grimfeld/lifeline/pulls/<n>/merge -f merge_method=merge`. This deploys, so the user or the orchestrator does it, never the script. |
| Merged | The original PRs show as merged. Run `pnpm worktrees:prune`. |

## When stuck

| Symptom | Fix |
| --- | --- |
| `pre-push: refusing to push commits made with an email other than…` | The hook prints the fix: amend or rebase with `-c user.email=claude@grimfeld.tech`. |
| `adr:check` or `migrations:check` **red** on your PR | Your own branch holds a number twice. Fix it there: `pnpm adr:mv` for an ADR, `pnpm migrations:next` and `git mv` for a migration. The exception is a migration that only "sorts before" master's newest because master moved on: leave that one, since the integration run renumbers it. |
| The same check only **warns** about another branch | Leave it. Whichever PR lands first keeps the number, and the integration run deals with the other. |
| `gh pr edit` fails (`projectCards`) | Use the REST API (`issue-tracker.md`). |
| Classes missing on a new App | Its `@source` line is missing from `shell/src/index.css`. |
| Unsure which model a subagent gets | `haiku` for lookups and merges, `sonnet` for implementing a settled design, `opus` for design, review and diagnosis. |
| A decision only the user can make | An agent with a user asks. A subagent decides from its spec and lists the decision in its report. |
