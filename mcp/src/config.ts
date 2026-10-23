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
  /**
   * Who the server signs in to PocketBase as, to keep the OAuth tables and mint
   * per-Account tokens: the `mcp_service` record (#263), or, until its secrets
   * are set, a superuser.
   */
  pbAccount: PbAccount;
  port: number;
  /** Redirect URIs a client may register: `MCP_REDIRECT_ALLOW`, comma-separated, or `DEFAULT_REDIRECT_ALLOW`. */
  redirectAllow: string[];
}

/**
 * Who may register as a client: claude.ai's connector callbacks, ChatGPT's
 * (one per connector, under `/connector/oauth/`, plus its older single
 * callback), and loopback on any port (Claude Code and other local clients).
 * The entry forms are in `redirectAllowed` (oauth.ts).
 */
export const DEFAULT_REDIRECT_ALLOW = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "https://chatgpt.com/connector/oauth/*",
  "https://chatgpt.com/connector_platform_oauth_redirect",
  "http://localhost:*",
  "http://127.0.0.1:*",
];

export function parseRedirectAllow(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_REDIRECT_ALLOW;
}

export interface PbAccount {
  collection: "mcp_service" | "_superusers";
  email: string;
  password: string;
}

/**
 * MCP_SERVICE_EMAIL / MCP_SERVICE_PASSWORD (the same secrets on lifeline-pb,
 * which keeps the record from them), else the superuser of old, with a warning.
 */
export function pbAccountFrom(env: Record<string, string | undefined>): PbAccount {
  if (env.MCP_SERVICE_EMAIL && env.MCP_SERVICE_PASSWORD) return { collection: "mcp_service", email: env.MCP_SERVICE_EMAIL, password: env.MCP_SERVICE_PASSWORD };
  if (env.PB_SUPERUSER_EMAIL && env.PB_SUPERUSER_PASSWORD) {
    console.warn("mcp: signing in to PocketBase as a superuser; set MCP_SERVICE_EMAIL and MCP_SERVICE_PASSWORD on both apps (#263)");
    return { collection: "_superusers", email: env.PB_SUPERUSER_EMAIL, password: env.PB_SUPERUSER_PASSWORD };
  }
  throw new Error("Missing environment variables MCP_SERVICE_EMAIL and MCP_SERVICE_PASSWORD");
}

export function loadConfig(): Config {
  return {
    baseUrl: new URL(required("BASE_URL")),
    pbUrl: required("PB_URL"),
    pbAccount: pbAccountFrom(process.env),
    port: Number(process.env.PORT ?? 8787),
    redirectAllow: parseRedirectAllow(process.env.MCP_REDIRECT_ALLOW),
  };
}

/** OAuth scopes. Read is always granted; write only when the user ticks "Allow changes" (unticked by default). */
export const SCOPE_READ = "lifeline:read";
export const SCOPE_WRITE = "lifeline:write";
export const SCOPES = [SCOPE_READ, SCOPE_WRITE];
