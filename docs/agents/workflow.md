# Workflow: what to do next

For the user and for agents. Find the line that matches where you are and do what it says.
The why is in `CLAUDE.md` and ADR 0132 (landing).

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
| PR's CI green | **Stop.** Don't merge master into it to refresh CI, and don't merge it alone. It waits for review and `/ship:land`. |
| PR finished | Mark it ready once `/ship:pr-review` has written its review section. The user adds `ship` and runs `/ship:land` (below). |
| PR merged | `pnpm worktrees:prune` clears the worktrees whose work is on master. |

## Landing

| You are here | Next |
| --- | --- |
| A PR you approve | Add `ship`. CI reruns with the whole e2e gate (about five minutes). |
| Approved PRs waiting | Run `/ship:land` (`/ship:land <pr>...` approves the named PRs first). For each, it merges master in, resolving conflicts, waits for its checks and merges it, parents before stacked PRs (`shipping.md`). |
| `land:` comment "Conflict resolution" | Nothing to do: it kept both sides and the PR landed or goes on to its checks. Read the choices if you want to. |
| `land:` comment: the sides contradict | Make the decision it names, on the branch: merge master in and push. The next `/ship:land` lands it. |
| `land:` comment: a check failed | Read the failing case. It was red before the merge, or `/ship:land` couldn't fix it in two tries: fix it on the branch, then `/ship:land` again. |
| Merged | Its merge commit deploys. Run `pnpm worktrees:prune`. |

## When stuck

| Symptom | Fix |
| --- | --- |
| `pre-push: refusing to push commits made with an email other than…` | The hook prints the fix: amend or rebase with `-c user.email=claude@grimfeld.tech`. |
| `adr:check` or `migrations:check` **red** on your PR | Your own branch holds a number twice. Fix it there: `pnpm adr:mv` for an ADR, `pnpm migrations:next` and `git mv` for a migration. The exception is a migration that only "sorts before" master's newest because master moved on: leave that one, since `/ship:land` renumbers it when it lands. |
| The same check only **warns** about another branch | Leave it. Whichever PR lands first keeps the number, and `/ship:land` renumbers the other when it lands. |
| `gh pr edit` fails (`projectCards`) | Use the REST API (`issue-tracker.md`). |
| Classes missing on a new App | Its `@source` line is missing from `shell/src/index.css`. |
| Unsure which model a subagent gets | `haiku` for lookups and merges, `sonnet` for implementing a settled design, `opus` for design, review and diagnosis. |
| A decision only the user can make | An agent with a user asks. A subagent decides from its spec and lists the decision in its report. |
