# The Demo is a separate build with no backend

Lifeline goes in a portfolio, so strangers need to be able to try it without an Account. The **Demo** is its own build (`VITE_DEMO=1`), deployed as its own Vercel project. It has no PocketBase, no sync and no sign-in. Every visitor gets a private copy of a made-up life in their own browser's local store. The copy is seeded on first open with dates that follow the visit day, and a Reset re-seeds it.

This works because Lifeline is already local-first: the UI only ever reads and writes the device's store, and sync runs only after sign-in. The Demo is the app with sync never started and the sign-in UI hidden.

## Considered options

- **A demo Account on the real PocketBase** — rejected: strangers would be one rules bug away from the owner's data, and every visitor would see what earlier visitors typed.
- **A runtime switch (`?demo`) on the real deployment** — rejected: the real bundle would carry the demo path, and the Demo would share an origin, and so a local store, with a device that may hold a real Account.
- **A shared, writable demo backend that is reset on a schedule** — rejected: it costs money and needs running, and between resets the next visitor sees whatever the last one wrote.
- **Read-only** — rejected: adding, completing and moving things is what Lifeline feels like.

## Consequences

- Anything that needs the server cannot be shown live: Mail (Google OAuth; since retired by ADR 0080), sync, the agent (MCP). Those are hidden in the Demo, and the agent is shown on video instead.
- The seeded life is hand-written content, kept apart from the e2e seed, which is deliberately absurd.
- A visitor's edits never leave their browser. Clearing site data is the same as a Reset.
- The switch is a build-time literal (`VITE_DEMO`, turned into `__LIFELINE_DEMO__` by the shell's Vite config), so the real build drops every Demo branch: its bundle carries no banner, no Reset and no made-up life.
