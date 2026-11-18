---
status: accepted
amends: ADR 0065 (in part — the layout check runs nightly, not at delivery), ADR 0096 (in part — the integration run's e2e is the delivery gate only)
---

# The e2e delivery gate runs behaviour flows at desktop width, phone cases by tag, and UI checks nightly

The e2e suite gated every batch and took 21–31 minutes on four runners, about 910 runs. A
third of them were UI checks rather than delivery checks: `screens.spec.ts` (~378 runs, ADR
0065), `a11y-names.spec.ts`, and `demo.spec.ts` with its two Demo builds (ADR 0077). And
every behaviour spec ran at phone and at desktop width, though most have no phone branch:
about 170 runs repeating each other. Specs picked their width themselves, with
`test.skip(isMobile)` or a viewport check, so nobody could see at a glance what ran where.

## Decision

**The delivery gate checks user flows.** The gate is a PR's `e2e-changed` and the
integration PR's run (ADR 0096). Both run only the gate projects, `desktop` and `mobile`, in
`shell/playwright.config.ts`.

- **Desktop is the default width.** The `desktop` project runs every behaviour case except
  those tagged `@phone`.
- **Phone runs are opted into by a tag on the case**, never by a file list or a
  `test.skip(isMobile)`. The `mobile` project runs only cases tagged `@phone` (phone width
  only) or `@also-phone` (both widths). `scripts/e2e-widths.test.mjs` fails on a gate spec
  that picks its width any other way.
- **UI checks run nightly.** A UI check asserts how something looks or reads: layout, axe,
  headings, accessible names. `screens.spec.ts` and `a11y-names.spec.ts` run in the
  `nightly-mobile` and `nightly-desktop` projects, and `demo.spec.ts` in `demo`. The nightly
  workflow (`.github/workflows/e2e.yml`) runs every project; a gate run never builds the Demo.
  A PR that changes one of those specs runs nothing for it in CI: the agent runs the rows it
  touched locally, and the nightly run catches the rest.
- **A red nightly run makes work, not a block.** It opens an issue labelled
  `ready-for-agent` naming the failing specs and cases (or comments on the one still open),
  for the night shift. Integration batches don't wait on it.
- **Logic goes in unit tests.** An e2e case at delivery proves a flow works; variants, edge
  cases and rules belong in vitest next to the code.

## Consequences

ADR 0065's check still holds every screen to the longest content, at both widths, but a
broken layout is found the next morning instead of at delivery, and an agent touching a
screen still runs its row before pushing. ADR 0096's integration PR still runs the whole
gate once; the gate is smaller. A phone-only behaviour (a tap path, the Phone dock, a
drawer) stays in the gate only while its case carries the tag.
