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
}

export function loadConfig(): Config {
  return {
    baseUrl: new URL(required("BASE_URL")),
    pbUrl: required("PB_URL"),
    pbSuperuserEmail: required("PB_SUPERUSER_EMAIL"),
    pbSuperuserPassword: required("PB_SUPERUSER_PASSWORD"),
    port: Number(process.env.PORT ?? 8787),
  };
}

/** OAuth scopes. Read is always granted; write only when the user leaves "Allow changes" ticked. */
export const SCOPE_READ = "lifeline:read";
export const SCOPE_WRITE = "lifeline:write";
export const SCOPES = [SCOPE_READ, SCOPE_WRITE];
