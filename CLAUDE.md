# Lifeline — notes for agents

Read `CONTEXT.md` (the language) and `docs/adr/` (the decisions) before changing behaviour.

A new ADR takes its number from `pnpm adr:new "The decision, as a sentence"`, never by
hand: it looks past every branch and worktree, so parallel work doesn't collide.
`pnpm adr:check` (in CI) fails when a number is taken twice; fix it with
`pnpm adr:mv docs/adr/NNNN-slug.md`, which moves an ADR to a free number. Of the two, the
decision scoped to one App (the narrower) moves and the cross-cutting one keeps its number.
`adr:mv` only renames: give the moved ADR `formerly: NNNN` in its frontmatter, and update
its "ADR NNNN" references by meaning, not search-and-replace (the old number still names
the other ADR).

A new PocketBase migration likewise takes its number from `pnpm migrations:next`;
`pnpm migrations:check` (in CI) fails on a number taken twice or one below master's newest —
renumber after merging master in.

## UI

Build from `@lifeline/ui` and its tokens; the rules are in `CODING_STANDARDS.md` § UI
(ADR 0079), and `pnpm check:ui` checks the lines you add.

- **Phone layout** (ADR 0064): on every page you touch, follow `CODING_STANDARDS.md`
  § Layout, and check it with a phone-width (390px) screenshot as well as a desktop one.
- **Long content** (ADR 0065): every screen survives the longest content a person could
  type (`CODING_STANDARDS.md` § Long content); a new screen gets a row in `SCREENS` in
  `shell/e2e/screens.spec.ts`.

## E2E tests

Run the e2e specs your change touches before pushing it, and the layout test
(`screens.spec.ts`) for a change to a screen; the commands are in `shell/e2e/README.md`.
A PR runs the specs it changes three times each; the whole suite runs on master each night
(`.github/workflows/e2e.yml`), so a red nightly run means master was already broken
before your change.

## Several agents share this machine

Start each piece of work with `pnpm worktree:new <name>`: a worktree under
`.claude/worktrees/<name>` on a new branch off `origin/master` (code, ADRs and CONTEXT.md
alike), installed and ready for e2e. The main checkout belongs to whoever opened it.
`pnpm worktrees:prune` clears the worktrees whose work is on master.

Agents working in parallel run only their own change's e2e specs; the full suite runs once,
before the integration branch merges.

A subagent has no user to ask. Where a skill says to confirm something with the user (test
seams, a design choice), take the answer from the spec, ticket or prompt you were given,
decide, and list each such decision in your report.

Commit, merge and rebase as `claude@grimfeld.tech` (`git -c user.email=claude@grimfeld.tech commit …`):
the machine's git email is private. A pre-push hook refuses any other email and prints the fix.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on grimfeld/lifeline (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (the glossary) + `docs/adr/` at the root. See `docs/agents/domain.md`.
