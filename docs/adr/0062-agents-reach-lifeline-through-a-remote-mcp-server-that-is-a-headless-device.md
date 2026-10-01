# Agents reach Lifeline through a remote MCP server that is a headless device

An AI agent — Claude on the web or the phone, Claude Code, any MCP client — should read the agenda, find Documents, create Tasks and Events and tick things off, from anywhere. We add a **remote MCP server** (`mcp/`, its own Fly app beside PocketBase) and make each Account's calls run in a **headless device**: a worker thread running Core and every App unchanged, over an in-memory IndexedDB that syncs with PocketBase exactly like a phone does — pull before a call, push after a write, last write wins. The agent therefore changes things only through the operations a person's UI uses: Core's gated store, the Contracts' hooks, and the Apps' own operations. Nothing about a Task's invariants is restated on the server.

App operations reach the agent as **headless Commands**. CONTEXT.md always said a Command "declares an argument signature"; the code never had one. A Command now may declare `args` (typed, with a `hint` for a caller that has no dialog) and `invoke(args)`, the same operation its dialog runs. Core checks the arguments against the signature (`invokeCommand`), the App judges the rest. Each such Command becomes one MCP tool (`tasks.add` → `tasks_add`). Generic tools cover what is already generic: Documents (search, get, create for body-first and user-defined types, update of non-guarded fields as a Base would), and the agenda and its moves through the **Schedulable** and **Timed** Contracts. Schedulable gains `itemsIn`, the non-React read Timed already had for Push; `surfaceItemsIn` resolves day pins and roll-forward as the Surfaces do.

The person signs in with **OAuth 2.1** on a page the server serves itself: claude.ai's connectors speak only OAuth, and PocketBase cannot be an authorization server. The server keeps registered clients and one grant per client per Account in two PocketBase collections no rule opens (superuser only), storing token hashes. It acts as the Account with short-lived PocketBase impersonation tokens minted by a superuser of its own, so the owner hook (ADR 0039) stamps every write and the list rules scope every read — isolation stays the server's, as before.

## Considered options

- **Plain REST API or PocketBase's own** — rejected: the raw collections bypass every App invariant (a Task created without `status: "active"` never shows), and no agent client discovers a REST API's shape.
- **Local stdio MCP on the desktop** — rejected by the goal: it is not there on the phone.
- **Per-user static token in the connector URL** — rejected: works everywhere but leaks through logs and settings screens, expires and scopes by hand; OAuth gives revocable, rotating, scoped grants.
- **Re-implement App operations in PocketBase hooks** — rejected: a second copy of every rule in a second runtime.
- **Generic `create_document` for every type** — rejected for App-owned types, for the same reason as REST; it is limited to the types the Vault itself creates generically (body-first) and user-defined ones, and names the App's tool otherwise.
- **The user's own PocketBase token, refreshed** — rejected: it expires after a week unused, which would disconnect a phone connector silently.

## Consequences

- Every App must be registered in `mcp/src/apps.ts` as well as the shell (a test checks it). A worker loads the Apps' views too; the build swaps browser-only libraries for inert stand-ins.
- One machine: pending sign-ins and warm devices live in its memory. A cold device pays one full pull of its Account; an idle one stops after 15 minutes, never while writes are still queued for the server.
- "Today" is the server's time zone (`TZ`), one for every Account.
- The Private folder is out of an agent's reach whether or not a password is set: never listed, read or written. Agents cannot delete.
- A read-only grant ("Allow changes" unticked) lists no write tools. Deleting a row of `mcp_grants` disconnects that client.
- A Schedulable provider without `itemsIn` is invisible to agents; a Command without `args`/`invoke` is too.
