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
  `shell/e2e/screens.spec.ts`.

## E2E tests

Run the e2e specs your change touches before pushing it, and the layout test
(`screens.spec.ts`) for a change to a screen; the commands are in `shell/e2e/README.md`. A
PR runs the specs it changes three times each (once on four runners past 150 cases). The
whole suite runs, sharded four ways, on every integration PR (`.github/workflows/check.yml`) and on
master each night (`.github/workflows/e2e.yml`), so a red nightly run means master was already broken before
your change.

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
alike), installed and ready for e2e. The main checkout belongs to whoever opened it.
`pnpm worktrees:prune` clears the worktrees whose work is on master.

**PRs land in batches (ADR 0096).** A PR runs its CI once. Once green, don't merge master
into it to refresh CI, and don't merge it alone: `pnpm integrate` (in a worktree of its
own) merges every green PR into one `integration/<date>` branch and opens one PR. Only that
PR's CI gates master. It skips a PR that conflicts and renumbers clashing migrations; an ADR
clash stops it, for `--continue` once fixed. When it goes red, `--drop <pr>` rebuilds it
without the PR at fault. It never merges itself: the user or the orchestrator merges the
integration PR, with a merge commit, never squash.

Agents working in parallel run only their own change's e2e specs, with
`pnpm test:e2e:quiet` (dot reporter: a dot per case, then the failures); the full suite runs once, before the integration
branch merges. A subagent reports in ten lines at most: branch, commit, what failed, and
each decision it took.

An orchestrator sets each subagent's `model`: `haiku` for lookups and merges, `sonnet` for
implementing against a settled design (call-site swaps, mechanical tickets), `opus` for
designing a new piece, review and diagnosis.

A subagent has no user to ask. Where a skill says to confirm something with the user (test
seams, a design choice), take the answer from the spec, ticket or prompt you were given,
decide, and list each such decision in your report.

A worktree made by `pnpm worktree:new` already commits as `claude@grimfeld.tech` (`48754678+grimfeld@users.noreply.github.com` also passes); the machine's git email
is private, and a pre-push hook refuses any other and prints the fix.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on grimfeld/lifeline (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (the glossary) + `docs/adr/` at the root. See `docs/agents/domain.md`.
