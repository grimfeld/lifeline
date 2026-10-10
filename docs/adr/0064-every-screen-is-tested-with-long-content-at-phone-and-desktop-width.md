# Every screen is tested with long content at phone and desktop width

Long titles, names and unbroken words kept breaking screens on the phone:
labels pushed counts and buttons off the side, grids grew wider than the
screen, text ran over its neighbours. Each was fixed where it was noticed, and
the next screen broke the same way.

## Decision

Every screen has an end-to-end test (Playwright, `shell/e2e/`) that opens it at
360px and at 1280px over a store seeded with the longest content a person could
type, and fails on any text that spills out of its box, is clipped sideways
without an ellipsis, or makes a box scroll sideways that was not meant to.

- **Seeded from the registry.** Every headless Command (ADR 0062) runs, every
  Document type gets a Document with every Field filled, every Card sits on one
  Screen. A new type, Field, Command or Card is under test the day it lands.
- **Screens are listed by hand, and the list is checked.** The routes with
  `:id`s and the Module pages need a person to say what to open; a test reads
  the App registry, Modules, Surfaces and Calendar views and fails on any
  screen without a row. Adding a screen without its test is a red build.
- **Long words wrap by default.** `overflow-wrap: anywhere` on `body` lets a
  word break instead of widening its grid or flex track. One-line labels opt
  into `truncate`; sideways scrollers opt in with `overflow-x-auto` or
  `data-scroll-x`, which is also how the check tells them from accidents.

## Consequences

A screen is not done until it passes at both widths. The suite runs against the
Vite dev server and imports Core at its `/@fs` path to seed, so it needs no
backend and no test hooks in the app.
