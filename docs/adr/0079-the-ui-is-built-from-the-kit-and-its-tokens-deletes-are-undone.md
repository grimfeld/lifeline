---
status: accepted
---

# The UI is built from the kit and its tokens; deletes are undone, not confirmed

By 2026-10 the app had grown across 27 Apps, each written screen by screen. A survey of 403 screen files found one system with many dialects: 160 palette colours standing in for "warning" and "good" in three shades each, 113 arbitrary text sizes, page titles in three sizes, sizes forced onto kit controls 230-odd times, 48 hand-made segmented controls with four looks, 64 icon buttons no screen reader can name — and four ways to delete something (a browser `confirm`, a two-tap button, a confirm dialog, an Undo toast), while ADR 0056 says "Undo, never confirm" and ADR 0072 asks for "one confirmation".

Screens are built from **`@lifeline/ui`** (shadcn/ui on Tailwind CSS v4) and the tokens in its `globals.css`, nothing else:

- Colour is a token. The theme gains **`success`** and **`warning`** (with `-foreground`) and maps the eight colour slots to classes (`bg-slot-blue`). Palette classes are out, save white or black text over a cover image.
- Type is a scale, gaining **`text-2xs`** (10px) for the smallest labels; no arbitrary sizes.
- Kit controls are sized by their props; every icon-only button has an `aria-label`.
- The layout switches at `md`, the phone line of ADR 0064; `usePhone()` is the one phone hook.
- What the kit lacks it gains, rather than each App hand-rolling it: Tooltip, ToggleGroup, AlertDialog, Combobox, Page, PageHeader, EmptyState, Field.

**Deletes are undone, not confirmed.** A delete happens at once and its toast offers Undo — Documents are soft-deleted, so Undo always works. One confirmation, in an AlertDialog, only for what Undo can't bring back: an empty type (ADR 0072), a Workspace, anything outside Lifeline. ADR 0056's rule for the Schedule becomes the rule everywhere, and 0072's confirmation is its exception.

The rules live in `CODING_STANDARDS.md` § UI. The mechanical ones are checked by `scripts/check-ui.mjs` on the lines a change adds, in CI; the rest are the reviewer's.

## Considered options

- **ESLint with a Tailwind plugin** — rejected for now: the repo has no lint setup, and a hundred-line script covers the mechanical rules with no config, no plugin versions and no editor integration to keep alive.
- **Check whole files a change touches** — rejected: a one-line fix would drag the whole file's history into the change. Added lines only; `--all` lists the backlog.
- **Confirm every delete** — rejected as in ADR 0056: slow, and a habit of clicking "Yes" protects nothing. Undo is the safety net.

## Consequences

- Existing screens break these rules about 775 times (`node scripts/check-ui.mjs --all`); they are cleaned up rule by rule, not in one sweep.
- A real exception carries `ui-allow: <rule> — why` beside it, so it is visible in review.
- New kit pieces must pass the long-content test (ADR 0065) at both widths before Apps adopt them.
