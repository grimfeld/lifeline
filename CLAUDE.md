# Lifeline — notes for agents

Read `CONTEXT.md` (the language) and `docs/adr/` (the decisions) before changing behaviour.

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
