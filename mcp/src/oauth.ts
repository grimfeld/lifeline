import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import PocketBase from "pocketbase";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { SCOPE_READ, SCOPE_WRITE } from "./config";
import { loginPage } from "./login";

/**
 * The MCP server is its own OAuth 2.1 authorization server (ADR 0062):
 * PocketBase cannot be one, and claude.ai's connectors speak only OAuth. A
 * person proves who they are once, with their Lifeline email and password, on
 * this server's page; the client then holds an opaque access token (1 h) and a
 * rotating refresh token (90 days, sliding). Grants live in PocketBase as
 * SHA-256 hashes; deleting the row disconnects the client.
 */

const ACCESS_SECONDS = 60 * 60;
const REFRESH_SECONDS = 90 * 24 * 60 * 60;
const PENDING_MS = 10 * 60_000;
const CODE_MS = 5 * 60_000;
const VERIFY_CACHE_MS = 30_000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;
const iso = (secondsFromNow: number) => new Date(Date.now() + secondsFromNow * 1000).toISOString().replace("T", " ");
const isPast = (pbDate: string) => new Date(pbDate.replace(" ", "T")).getTime() <= Date.now();

interface PendingAuthorization {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  expires: number;
}

interface AuthorizationCode {
  clientId: string;
  userId: string;
  scopes: string[];
  codeChallenge: string;
  redirectUri: string;
  resource?: string;
  expires: number;
}

interface GrantRow {
  id: string;
  user: string;
  client_id: string;
  scopes: string;
  access_expires: string;
  refresh_expires: string;
  resource: string;
}

/**
 * Scopes as granted: read always, write when "Allow changes" is ticked on the
 * page. The page is the consent, whatever scopes the client asked for:
 * claude.ai's connector asks without `lifeline:write`, and honouring that
 * hid the checkbox and left every grant read-only.
 */
export function grantedScopes(allowWrite: boolean): string[] {
  return [SCOPE_READ, ...(allowWrite ? [SCOPE_WRITE] : [])];
}

export class LifelineOAuth implements OAuthServerProvider {
  private pending = new Map<string, PendingAuthorization>();
  private codes = new Map<string, AuthorizationCode>();
  private verified = new Map<string, { info: AuthInfo; until: number }>();

  constructor(
    /** Superuser client: the OAuth collections have no rules, so only it reads them. */
    private admin: PocketBase,
    private pbUrl: string,
  ) {}

  readonly clientsStore: OAuthRegisteredClientsStore = {
    getClient: async (clientId) => {
      const row = await this.admin
        .collection("mcp_clients")
        .getFirstListItem(this.admin.filter("client_id = {:id}", { id: clientId }))
        .catch(() => null);
      return (row?.info as OAuthClientInformationFull | undefined) ?? undefined;
    },
    registerClient: async (client) => {
      const full = client as OAuthClientInformationFull;
      await this.admin.collection("mcp_clients").create({ client_id: full.client_id, info: full });
      return full;
    },
  };

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.pending) if (v.expires < now) this.pending.delete(k);
    for (const [k, v] of this.codes) if (v.expires < now) this.codes.delete(k);
    for (const [k, v] of this.verified) if (v.until < now) this.verified.delete(k);
  }

  /** Step 1: show the sign-in page. The request is remembered under an unguessable id the form posts back. */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    this.sweep();
    const request = randomBytes(24).toString("base64url");
    this.pending.set(request, { client, params, expires: Date.now() + PENDING_MS });
    res.status(200).type("html").send(loginPage({ request, clientName: client.client_name, redirectUri: params.redirectUri, write: true }));
  }

  /**
   * Step 2, the page's POST: check the password with PocketBase, then send the
   * browser back to the client with a one-time code. Returns the page to show
   * again on a wrong password.
   */
  async completeLogin(form: { request?: string; email?: string; password?: string; allow_write?: string; deny?: string }, res: Response): Promise<void> {
    this.sweep();
    const p = form.request ? this.pending.get(form.request) : undefined;
    if (!p) {
      res.status(400).type("html").send(loginPage({ expired: true }));
      return;
    }
    const back = new URL(p.params.redirectUri);
    if (p.params.state !== undefined) back.searchParams.set("state", p.params.state);
    if (form.deny) {
      this.pending.delete(form.request!);
      back.searchParams.set("error", "access_denied");
      res.redirect(302, back.href);
      return;
    }
    let userId: string;
    try {
      const auth = await new PocketBase(this.pbUrl).collection("users").authWithPassword(String(form.email ?? ""), String(form.password ?? ""));
      userId = auth.record.id;
    } catch {
      res.status(401).type("html").send(loginPage({ request: form.request, clientName: p.client.client_name, redirectUri: p.params.redirectUri, write: true, email: form.email, error: "Wrong email or password." }));
      return;
    }
    this.pending.delete(form.request!);
    const code = randomBytes(32).toString("base64url");
    this.codes.set(code, {
      clientId: p.client.client_id,
      userId,
      scopes: grantedScopes(form.allow_write === "on"),
      codeChallenge: p.params.codeChallenge,
      redirectUri: p.params.redirectUri,
      resource: p.params.resource?.href,
      expires: Date.now() + CODE_MS,
    });
    back.searchParams.set("code", code);
    res.redirect(302, back.href);
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<string> {
    const c = this.codes.get(code);
    if (!c || c.clientId !== client.client_id || c.expires < Date.now()) throw new InvalidGrantError("Invalid or expired authorization code");
    return c.codeChallenge;
  }

  /** Step 3: code → tokens. PKCE was checked by the SDK against challengeForAuthorizationCode. */
  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL): Promise<OAuthTokens> {
    const c = this.codes.get(code);
    this.codes.delete(code);
    if (!c || c.clientId !== client.client_id || c.expires < Date.now()) throw new InvalidGrantError("Invalid or expired authorization code");
    if (redirectUri !== undefined && redirectUri !== c.redirectUri) throw new InvalidGrantError("redirect_uri does not match the authorization request");
    if (resource && c.resource && resource.href !== c.resource) throw new InvalidGrantError("resource does not match the authorization request");
    const access = token("lla");
    const refresh = token("llr");
    await this.admin.collection("mcp_grants").create({
      user: c.userId,
      client_id: client.client_id,
      client_name: client.client_name ?? "",
      scopes: c.scopes.join(" "),
      access_hash: sha256(access),
      access_expires: iso(ACCESS_SECONDS),
      refresh_hash: sha256(refresh),
      refresh_expires: iso(REFRESH_SECONDS),
      resource: c.resource ?? resource?.href ?? "",
    });
    return { access_token: access, token_type: "bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: c.scopes.join(" ") };
  }

  /** Refresh: both tokens rotate, so a stolen refresh token stops working once the real client uses its own. */
  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens> {
    const row = await this.grantBy("refresh_hash", refreshToken);
    if (!row || row.client_id !== client.client_id || isPast(row.refresh_expires)) throw new InvalidGrantError("Invalid or expired refresh token");
    const had = row.scopes.split(" ");
    if (scopes?.some((s) => !had.includes(s))) throw new InvalidGrantError("Cannot widen the scopes of a grant");
    const keep = scopes?.length ? scopes : had;
    const access = token("lla");
    const refresh = token("llr");
    await this.admin.collection("mcp_grants").update(row.id, {
      scopes: keep.join(" "),
      access_hash: sha256(access),
      access_expires: iso(ACCESS_SECONDS),
      refresh_hash: sha256(refresh),
      refresh_expires: iso(REFRESH_SECONDS),
    });
    return { access_token: access, token_type: "bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: keep.join(" ") };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthInfo> {
    const hash = sha256(accessToken);
    const hit = this.verified.get(hash);
    if (hit && hit.until > Date.now()) return hit.info;
    const row = await this.grantBy("access_hash", accessToken);
    if (!row || isPast(row.access_expires)) throw new InvalidTokenError("Invalid or expired access token");
    const info: AuthInfo = {
      token: accessToken,
      clientId: row.client_id,
      scopes: row.scopes.split(" "),
      expiresAt: Math.floor(new Date(row.access_expires.replace(" ", "T")).getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { userId: row.user },
    };
    this.verified.set(hash, { info, until: Math.min(Date.now() + VERIFY_CACHE_MS, info.expiresAt! * 1000) });
    void this.admin.collection("mcp_grants").update(row.id, { last_used: iso(0) }).catch(() => undefined);
    return info;
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const row = (await this.grantBy("access_hash", request.token)) ?? (await this.grantBy("refresh_hash", request.token));
    if (!row || row.client_id !== client.client_id) return;
    this.verified.clear();
    await this.admin.collection("mcp_grants").delete(row.id).catch(() => undefined);
  }

  private async grantBy(field: "access_hash" | "refresh_hash", raw: string): Promise<GrantRow | null> {
    return this.admin
      .collection("mcp_grants")
      .getFirstListItem<GrantRow>(this.admin.filter(`${field} = {:h}`, { h: sha256(raw) }))
      .catch(() => null);
  }
}
