---
status: accepted
amends: ADR 0050 (in part — a Handoff may come from outside Lifeline)
supersedes: ADR 0051
---

# Mail is retired: a browser extension and the share sheet hand off to Intakes instead

ADR 0051 made Mail a window onto Gmail through Google's browser token flow. In use it did nothing Gmail's own app does not do better. Its sign-in also lapsed every hour, and it could not reach anyone else: Gmail's read scopes are restricted, so opening it to other people means Google's app verification and a paid yearly security assessment. Outside "Testing" there is no way around that, and "Testing" caps the app at a hundred hand-listed users. The one thing Lifeline adds to email is **keeping** a message: making a Task, an Event or a Quote from it through an Intake (ADR 0050). That job does not need a mail client. It needs a way to make a Handoff from outside Lifeline, which every web page, not only email, wants too.

So **the Mail App is removed**, and a Handoff can now be made outside Lifeline. The **Lifeline extension** (Chrome-family and Firefox) offers **Send to Lifeline** on any page, Gmail's included. It reads the selection (as markdown), the page's title and URL, and the author and date when the page declares them in its meta tags. It opens Lifeline's **Handoff page** in a small window with that Handoff in the URL fragment, so the Handoff stays out of server logs. The page asks for the Intake (unless the context menu already named one) and the Workspace (defaulting to the last one used), then opens the Intake's own dialog. Nothing is written until that dialog saves. The extension rides the web app's sign-in: no token, no second auth client, no write path of its own. On Android the same page is the PWA's **share target**, so "Share → Lifeline" works from the Gmail app or any other.

## Considered options

- **Keep Gmail OAuth** — rejected: verification plus a paid assessment to serve anyone but test users, an hourly sign-in, and Gmail only.
- **IMAP with app passwords through a server proxy** — rejected: browsers cannot speak IMAP, so a proxy would hold every user's mailbox password. Outlook.com no longer accepts passwords for IMAP at all.
- **Forwarding to a per-Account inbound address** (Cloudflare Email Routing to a Worker to PocketBase) — the strongest alternative: free, every provider, and it works from any phone. Rejected for now: it needs a Worker, MIME parsing, parsing each client's "Forwarded message" block, Gmail's forwarding confirmation, a new stored type and a purge job. And it serves email only. It stays the answer if the iOS gap below starts to hurt.
- **The extension calls the MCP server's tools** — rejected: MCP is an agent protocol, with its own OAuth and tools that save straight away. They would skip the Intake dialog, and that dialog is the review.
- **Context-menu entries that save without a dialog** — rejected for the same reason: the Intake contract keeps ownership whole by letting only the receiving App's form write.

## Consequences

- `apps/mail`, the `mailbox` type, the `_mail_cache` table, the Mail Module, its Cards and Commands and `VITE_GOOGLE_CLIENT_ID` are gone. A PocketBase migration deletes `mailbox` Documents. They held only addresses, and nothing at Google changes.
- The glossary retires Mail, Mailbox, Thread, Message, Label and Triage, and widens Handoff to come from outside Lifeline.
- A new shell route, the Handoff page, decodes a Handoff from the fragment or, for the share target (GET, so no service worker has to read a POST body), from the query string. If the person is signed out, it signs them in first and then resumes.
- The Handoff and its fragment codec live in `@lifeline/handoff` (`packages/handoff`), a package with no dependencies, so the extension can share it without pulling in Core; Core re-exports the `Handoff` type. An Intake's dialog reports its save through `onSaved(id)`, which is how the Handoff page tells a save from a cancel before it moves to `/handoff/done`, the address the extension closes its window at.
- The extension is its own workspace package, one MV3 codebase for both browsers, published to the Chrome Web Store and Firefox Add-ons. It has no options: the deployed origin is built in, and a self-hosted Lifeline builds its own copy with the constant changed. The submenu of Intakes comes from a list the shell publishes, so a new Intake needs no extension release.
- On browser-internal pages (`chrome://`), Chrome hides the tab's title and URL from an extension without the `tabs` permission, so the Handoff arrives empty there. Accepted, to avoid the history-reading install warning `tabs` brings.
- No DOM scraping, Gmail's included: a mail's sender reaches the Handoff only if it was selected.
- iOS has no extension or share target for a web app. It gets nothing in this ADR. The fallback is a documented iOS Shortcut that opens the Handoff page, or forwarding later.
- Supersedes ADR 0051.
