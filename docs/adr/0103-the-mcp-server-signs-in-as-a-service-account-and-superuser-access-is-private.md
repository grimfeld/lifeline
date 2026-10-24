---
status: accepted
---

# The MCP server signs in as a service account, and superuser access is private

The MCP server (ADR 0062) signed in to PocketBase as a superuser (#263), to keep its OAuth tables and to mint tokens acting as an Account. A compromised MCP app could read and write every Account. PocketBase's superuser sign-in and admin UI (`/_/`) were also reachable from the internet (#258), so the MCP login's rate limit could be bypassed by guessing passwords against PocketBase directly.

**The MCP server signs in as the one record of `mcp_service`**, an auth collection nobody can sign up to or list:

- The OAuth tables (`mcp_clients`, `mcp_grants`) open to that record alone.
- `pb_hooks/mcp_service.pb.js` mints a token acting as an Account (`POST /api/lifeline/mcp/impersonate/{id}`, at most a day). Only the service record or a superuser may call it.
- PocketBase keeps the record from the `MCP_SERVICE_EMAIL` / `MCP_SERVICE_PASSWORD` secrets at each start. The MCP server signs in with the same pair, so rotating it means changing one pair of secrets on both apps.
- Until those secrets exist, the MCP server falls back to the superuser with a warning, so either app can deploy first.

**Superuser access is private.** With `PB_ADMIN_PRIVATE=1`, PocketBase refuses `/_/` and every route of the `_superusers` collection (by name or by id) to requests that came through Fly's public edge, which carry `Fly-Client-IP`. Admin work goes through `fly proxy 8080 -a lifeline-pb`. The flag is off until set, because an MCP server still on the superuser signs in over the public URL.

## Considered options

- **A shared-secret endpoint for every OAuth table operation.** Rejected: an auth collection with rules gives the same scope through PocketBase's own API, and only impersonation needs a hook.
- **Keep the superuser and rotate its password on a schedule.** Rejected: a rotated superuser is still a superuser.
- **Block `/_/` at a proxy in front of PocketBase.** Rejected: Fly's `http_service` has no path rules, and a second app in front only for that costs more than a middleware.

## Consequences

- The operator sets the secrets, then `PB_ADMIN_PRIVATE=1`, then retires the MCP superuser. They also turn on PocketBase's rate limits (`*:auth`) and superuser MFA, which are database settings.
- A compromised MCP app can still act as any Account through the impersonate route, but it can no longer read or change PocketBase's settings, collections or superusers.
