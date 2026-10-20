# Writing the Guide

The **Guide** (CONTEXT.md, ADR 0089) is Lifeline's manual, read inside the app at `/guide` and
by Claude through the MCP `guide` tool. Its pages are the Markdown files in `pages/`, listed in
`src/index.ts`. They describe the app as the user meets it: one page per **Module**, per
**Surface**, and per Core concept — never per App.

## Who reads it

The user, while using Lifeline, who has forgotten what exists or how it works. Write for them,
plainly, in the second person ("Tap **+** and pick…"), so someone new could follow too. Use the
glossary's words (Module, Card, Capture sheet, Phone dock…) — the Guide is where a person learns
them — but never internal ones (manifest, Contract, registry, hook, headless). Say what a thing
is *for* and how to reach it; no history, no "since ADR…", no code.

## Shape of a Module page

```markdown
# <Module title>

One or two lines: what this Module is for.

## <App title, as the user sees it>

What you keep here: the kinds of thing, in a line.

- **<Command, view or Card title>** — what it does, in one line. Where: <the page, the Capture
  sheet, the palette (Ctrl+K), a Card you can place>.
- …

## Capture

What **+** (or Ctrl+K) offers from this Module.

## Ask Claude

What you can ask Claude to do here, through the Lifeline connector — e.g. "Add a chore",
`chores_add`.

## Tips

## Related

- [Calendar](calendar.md) — links are to other pages' files.
```

A Surface or Core page keeps the same voice: what it is for, what you can do (one line each,
with where), Tips, Related.

## Keeping it current

Every change that adds, renames, removes or reworks something a user sees updates the page
that covers it, in the same PR. `pnpm --filter @lifeline/shell test` fails while a Command or
Card of an App is not named on its page (the title as shown, any trailing "…" dropped), or a
Module or Surface has no page. A deliberate omission goes in `UNLISTED` in
`shell/src/guide/guide.test.ts`, with a reason.

Text only: no screenshots, which go stale with every change to the UI and no test can tell.
