/** Server configuration, from the environment (Fly secrets in production, `mcp/.env` locally). */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export interface Config {
  /** Public origin of this server, e.g. https://lifeline-mcp.fly.dev — the OAuth issuer. */
  baseUrl: URL;
  /** Where the server reaches PocketBase (over Fly's private network in production). */
  pbUrl: string;
  /** A PocketBase superuser for this server alone: it keeps the OAuth tables and mints per-Account tokens. */
  pbSuperuserEmail: string;
  pbSuperuserPassword: string;
  port: number;
  /** Redirect URIs a client may register: `MCP_REDIRECT_ALLOW`, comma-separated, or `DEFAULT_REDIRECT_ALLOW`. */
  redirectAllow: string[];
}

/**
 * Who may register as a client: claude.ai's connector callbacks, and loopback
 * on any port (Claude Code and other local clients). An entry is an exact URL
 * or `scheme://host:*` for any port and path on that host.
 */
export const DEFAULT_REDIRECT_ALLOW = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "http://localhost:*",
  "http://127.0.0.1:*",
];

export function parseRedirectAllow(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_REDIRECT_ALLOW;
}

export function loadConfig(): Config {
  return {
    baseUrl: new URL(required("BASE_URL")),
    pbUrl: required("PB_URL"),
    pbSuperuserEmail: required("PB_SUPERUSER_EMAIL"),
    pbSuperuserPassword: required("PB_SUPERUSER_PASSWORD"),
    port: Number(process.env.PORT ?? 8787),
    redirectAllow: parseRedirectAllow(process.env.MCP_REDIRECT_ALLOW),
  };
}

/** OAuth scopes. Read is always granted; write only when the user ticks "Allow changes" (unticked by default). */
export const SCOPE_READ = "lifeline:read";
export const SCOPE_WRITE = "lifeline:write";
export const SCOPES = [SCOPE_READ, SCOPE_WRITE];
