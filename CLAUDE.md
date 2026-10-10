# Working on Lifeline

Read `CONTEXT.md` for the language and `docs/adr/` (numerically) for the decisions.

## Every screen holds long content, on a phone and on a desk (ADR 0064)

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

CI runs it on every pull request and push to `master` (`.github/workflows/e2e.yml`,
one job per width; the Playwright report is uploaded when it fails).
Run it locally: `pnpm test:e2e` (or `pnpm --filter @lifeline/shell test:e2e -- --project=mobile -g Tasks`).
