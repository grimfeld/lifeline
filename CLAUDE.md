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

## Phone layout (ADR 0064) — follow on every page you touch

Below `md` (768px) is the phone. On the desk nothing below applies.

- **Controls sit at the bottom**, in the Phone dock right above the Phone bar: tabs, view switches, date
  paging, search, the main add. Wrap them in `PhoneDock` from `@lifeline/ui` (renders in place on the desk).
  Titles, quick-add fields, banners and a single item's own header (back/edit/delete) stay at the top.
- **One line, as much as possible.** All of a page's `PhoneDock`s share one wrapping line — don't build
  extra rows. Filters beyond a search go in `PhoneFilters` (a Filters button + bottom sheet).
- **Alone on a line → full width.** Dock items grow to fill their line (icon buttons excepted), so pass
  controls, not wrapper divs; a grouping div gets `max-md:contents`.
- **Selectors, not tabs.** `TabsList` already becomes a select on a phone. Hand-made single-choice switches
  (segmented buttons, status chips) use a `Select` on the phone (`usePhone()`).
- `order={1}` for tabs/view switches (nearest the thumb); actions, search and Filters at the default 0.
- Check with a phone-width (390px) screenshot as well as a desktop one.

## UI

Build from `@lifeline/ui` and its tokens; the rules are in `CODING_STANDARDS.md` § UI
(ADR 0079), and `pnpm check:ui` checks the lines you add.

## Every screen holds long content, on a phone and on a desk (ADR 0065)

A screen is not done until it survives the longest content a person could type.
`shell/e2e/screens.spec.ts` opens every screen at phone (360px) and desktop
(1280px) width over a store seeded with very long titles, fields, folders, tags
and unbroken words, and fails when text spills out of its box, is cut off
without an ellipsis, or makes a box scroll sideways that was not meant to.

- **A new screen gets a row in `SCREENS`** (App screen, Module page, Core page,
  Calendar view, detail page with `:id` + `type`). The test "every screen has a
  row in this file" fails until it does.
- New Document types, Fields, headless Commands and Cards are seeded
  automatically from the registry — nothing to add, but they are checked.
- Long words wrap by default (`overflow-wrap: anywhere` on `body`). A label that
  must stay on one line uses `truncate` and its flex parent gets `min-w-0`; a
  flex row with a label and fixed bits (counts, dates, buttons) gives the label
  `min-w-0 flex-1` and the fixed bits `shrink-0`.
- A box meant to scroll sideways (a week grid, a wide table, a tab strip) says
  so with `overflow-x-auto` or `data-scroll-x`.
- Text that overhangs its box on purpose (a heatmap's month label running over
  empty cells) carries `data-layout-ignore` and a comment saying why. Rare.

It is not in CI (too slow): run it before pushing a change that touches a screen.
`pnpm test:e2e` (or `pnpm --filter @lifeline/shell test:e2e --project=mobile -g Tasks` —
no `--` before the flags). It starts its own server on port 1421; set `E2E_PORT` to
another port when that one is taken.

## Several agents share this machine

Work in a `git worktree` off `origin/master` (code, ADRs and CONTEXT.md alike); the
main checkout belongs to whoever opened it.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on grimfeld/lifeline (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (the glossary) + `docs/adr/` at the root. See `docs/agents/domain.md`.
