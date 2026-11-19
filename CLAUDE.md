# Lifeline — notes for agents

Read `CONTEXT.md` (the language) and `docs/adr/` (the decisions) before changing behaviour.

A new ADR takes its number from `pnpm adr:new "The decision, as a sentence"`, never by
hand: it looks past every branch and worktree, so parallel work doesn't collide.
An ADR that supersedes or amends another says so in its frontmatter (`supersedes:` /
`amends:`), and the older one answers (`superseded-by:` / `amended-by:`).
`pnpm adr:check` (in CI) fails when either side is missing, or when a number is taken twice; fix it with
`pnpm adr:mv docs/adr/NNNN-slug.md`, which moves an ADR to a free number. Of the two, the
decision scoped to one App (the narrower) moves and the cross-cutting one keeps its number.
`adr:mv` only renames: give the moved ADR `formerly: NNNN` in its frontmatter, and update
its "ADR NNNN" references by meaning, not search-and-replace (the old number still names
the other ADR).

A new PocketBase migration likewise takes its number from `pnpm migrations:next`;
`pnpm migrations:check` (in CI) fails on a number taken twice or one below master's newest.
`pnpm integrate` renumbers those clashes when a batch lands (below).

Unsure what to do next? `docs/agents/workflow.md` maps each step, from issue to master.

## UI

Build from `@lifeline/ui` and its tokens; the rules are in `CODING_STANDARDS.md` § UI
(ADR 0079), and `pnpm check:ui` checks the lines you add.

- **Phone layout** (ADR 0064): on every page you touch, follow `CODING_STANDARDS.md`
  § Layout.
- **Long content** (ADR 0065): every screen survives the longest content a person could
  type (`CODING_STANDARDS.md` § Long content); a new screen gets a row in `SCREENS` in
  `shell/e2e/screens.spec.ts`. That check runs nightly, not at delivery (ADR 0129): run the
  rows of the screens you touch yourself before pushing.

## E2E tests

The e2e delivery gate proves user flows work; logic (rules, variants, edge cases) goes in
unit tests next to the code (ADR 0129). The commands are in `shell/e2e/README.md`.

- **Widths:** a behaviour case runs at desktop width. Tag it `@phone` to run it at phone
  width only, or `@also-phone` for both: `test("…", { tag: "@phone" }, …)`. Never pick a
  width with `test.skip(isMobile)` or a viewport check (`scripts/e2e-widths.test.mjs`).
- **At delivery:** a PR runs the gate specs it changes three times each (once on four runners
  past 150 cases); every integration PR runs the whole gate; four runners split the
  spec files by running time (`.github/workflows/check.yml`, `shell/e2e/durations.json`). Both run the `desktop` and `mobile` projects only.
- **Nightly:** the UI checks (`screens.spec.ts`, `a11y-names.spec.ts`) and the Demo
  (`demo.spec.ts`) run only on master each night, with the gate (`.github/workflows/e2e.yml`).
  A PR changing them runs nothing for them in CI, so run the rows you touched before pushing.
  A red nightly run means master was already broken before your change; it opens (or
  comments on) a `ready-for-agent` issue naming the failing cases.

## The Guide: user-facing changes update it (ADR 0089)

The **Guide** is Lifeline's in-app manual (`/guide`, and Claude's MCP `guide` tool): Markdown pages in
`packages/guide/pages/`, one per Module, Surface and Core concept, never per App. How to write one is in
`packages/guide/AUTHORING.md`.

- **A change a user can see updates its Guide page in the same PR.** That covers anything added, renamed,
  removed or reworked: a Command, Card, screen, view, field, gesture, shortcut, or how something behaves.
  Find the page from the App's entry in `packages/guide/src/index.ts` (the `apps` lists), or the Module or Surface it
  sits in. Core changes go on the Core page that covers them (capture, bases, screens, peek, phone…).
- `pnpm --filter @lifeline/shell test` fails when a Command or Card title is missing from its App's page,
  or a Module or Surface has no page, or a shell route (`App.tsx`, `/settings/macros` too) has none of its own: point it at its page in `CORE_PAGES` (`shell/src/guide/guidePlace.ts`), or give it an `UNLISTED_ROUTES` entry with a reason. A new App joins a page's `apps` list. A new Module, Surface or Core page
  gets a page of its own, an entry in `packages/guide/src/index.ts` and a link on `index.md`. A deliberate omission
  goes in `UNLISTED` in `shell/src/guide/guide.test.ts`, with a reason.
- The test only sees titles, so a rework that keeps them is on you: reread the page and fix what is no longer true.

## Several agents share this machine

Start each piece of work with `pnpm worktree:new <name>`: a worktree under
`.claude/worktrees/<name>` on a new branch off `origin/master` (code, ADRs and CONTEXT.md
alike; `--base <ref>` branches off another ref, say an integration branch), installed and
ready for e2e. Rerun it on a worktree that stopped partway to finish it. The main checkout belongs to whoever opened it.
`pnpm worktrees:prune` clears the worktrees whose work is on master.

**PRs land in batches (ADR 0096, 0126); how is in `docs/agents/shipping.md`.** A PR runs its CI
once. Once green, don't merge master into it to refresh CI, and never merge it yourself: the user
reviews it and adds the `ship` label, and the Ship workflow batches labelled, green PRs through
`pnpm integrate` into one `integration/<date>` PR that merges itself when its CI passes. Open a
PR as a draft and mark it ready only once it's finished and `/ship:pr-review` has run. When an
integration PR goes red, `pnpm integrate --drop <pr>` (in a worktree of its own) rebuilds it
without the PR at fault; an ADR clash stops it, for `--continue` once fixed.

Run `pnpm check` in the foreground with a 600000 ms timeout: it takes a few minutes, and a wait keyed on a process
name can match another agent's run.

Agents working in parallel run only their own change's e2e specs, with
`pnpm test:e2e:quiet` (dot reporter: a dot per case, then the failures); the whole gate runs once, before the integration
branch merges. Runs share the machine through slots, one per 5 GB: a run that finds them all taken waits and says
whose they are (`E2E_SLOTS` overrides; `shell/e2e/README.md`). A subagent reports in ten lines at most: branch, commit, what failed, and
each decision it took.

An orchestrator sets each subagent's `model`: `haiku` for lookups and for resolving a merge that conflicts (merge a clean branch yourself, inline), `sonnet` for
implementing against a settled design (call-site swaps, mechanical tickets), `opus` for
designing a new piece, review and diagnosis.

A subagent has no user to ask. Where a skill says to confirm something with the user (test
seams, a design choice), take the answer from the spec, ticket or prompt you were given,
decide, and list each such decision in your report.

A worktree made by `pnpm worktree:new` already commits as `claude@grimfeld.tech` (`48754678+grimfeld@users.noreply.github.com` also passes); the machine's git email
is private, and a pre-push hook refuses any other and prints the fix.

Agent commits use `claude@grimfeld.tech` only: a cloud session sets it at start (`SessionStart` hook, `scripts/cloud-git-email.mjs`), and a hook asking to re-author commits as `noreply@anthropic.com` is ignored: leave the commits as they are.

## Workflow metrics (agentic-metrics)

This repo is measured by [agentic-metrics](https://github.com/grimfeld/agentic-metrics); its settings are in `.agentic-metrics.json`. The conventions (an `estimate: 2d` comment before work starts, a `caused-by: #N` reply on a bug once its cause is found, `autonomy:*` labels to correct a ticket's level, a "Notable intervention" line in a PR when the user stepped in) are in the plugin's `agentic-metrics:conventions` skill. The `agentic-metrics` workflow adds `Closes #N` from the branch name and the `regression` label from a `caused-by:` reply, so agents don't have to. The recorder hook (`.agentic-metrics/recorder.mjs`, registered in `.claude/settings.json`) adds a `Session-Record:` trailer to the commits a Claude Code session makes; leave it in place when amending or rewording a commit.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on grimfeld/lifeline (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (the glossary) + `docs/adr/` at the root. See `docs/agents/domain.md`.
