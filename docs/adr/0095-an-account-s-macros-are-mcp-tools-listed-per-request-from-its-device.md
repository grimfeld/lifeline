---
status: accepted
---

# An Account's Macros are MCP tools listed per request from its device

The MCP server's catalogue (ADR 0062) is built once at import, on the main thread, with no Account: every tool is a generic one or an App's headless Command, both fixed at compile time. A headless Macro (ADR 0092) should be a tool too, its asked arguments the tool's arguments, but Macros are the Account's own data, held only by its device worker.

**The server lists an Account's Macro tools per request, from its device.** When a request with the write scope lists tools, or calls a tool that is not in the static catalogue, the server asks the Account's device for its Macro tools (`macroTools` in `mcp/src/tools.ts`: plain descriptors, so they cross the worker boundary), turns them into tool specs beside `TOOLS`, and registers them on that request's server. `initialize` and calls to static tools never wait on the device. A device that cannot answer costs the listing its Macro tools, never the listing itself. The device finds a called tool again by building the same list, so a tool's name is derived from its Macro alone: `macro_<name>`, or with the Macro's id when two Macros share a name.

A Macro tool runs through the headless-Command path (`invokeCommand` over `macroCommand`), and its result carries the report the run sends: every step done, skipped, stopped or not reached. `list_macros`, `create_macro` and `update_macro` are static tools; the last two check a Macro with `checkMacro`, as the app's editor does, and refuse a broken one. No tool deletes a Macro.

## Considered options

- **One generic `run_macro { macro, args }` tool**: rejected. Its arguments cannot be typed per Macro, so an agent would learn each Macro's asked arguments from `list_macros` and pass them untyped, and a Macro would not be a tool like any other Command.
- **Notifying clients when Macros change (`tools/list_changed`)**: not possible on a stateless server with no stream; a client sees new Macro tools the next time it lists them.
