import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type PocketBase from "pocketbase";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { Response } from "express";
import type { AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { DEFAULT_REDIRECT_ALLOW, parseRedirectAllow } from "./config";
import { loginPage } from "./login";
import { LifelineOAuth, LoginAttempts, redirectAllowed } from "./oauth";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const later = new Date(Date.now() + 86_400_000).toISOString().replace("T", " ");

/** A stand-in for the superuser client over one mcp_grants row. */
function fakeAdmin(row: Record<string, string>) {
  const update = vi.fn(async (_id: string, patch: Record<string, string>) => {
    await new Promise((r) => setTimeout(r, 10));
    Object.assign(row, patch);
  });
  const admin = {
    filter: (expr: string, params: { h: string }) => ({ field: expr.split(" ")[0], h: params.h }),
    collection: () => ({
      getFirstListItem: async (f: { field: string; h: string }) => {
        await new Promise((r) => setTimeout(r, 5));
        if (row[f.field] !== f.h) throw new Error("404");
        return { ...row };
      },
      update,
    }),
  };
  return { admin: admin as unknown as PocketBase, update };
}

const client = { client_id: "c1" } as OAuthClientInformationFull;

describe("refresh-token rotation", () => {
  it("spends a refresh token once, even when two refreshes race", async () => {
    const row = { id: "g1", user: "u1", client_id: "c1", scopes: "lifeline:read", refresh_hash: sha256("llr_old"), refresh_expires: later, access_expires: later, resource: "" };
    const { admin, update } = fakeAdmin(row);
    const oauth = new LifelineOAuth(admin, "http://pb");
    const results = await Promise.allSettled([oauth.exchangeRefreshToken(client, "llr_old"), oauth.exchangeRefreshToken(client, "llr_old")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InvalidGrantError);
    expect(update).toHaveBeenCalledTimes(1);
    // And once spent, it stays spent.
    await expect(oauth.exchangeRefreshToken(client, "llr_old")).rejects.toBeInstanceOf(InvalidGrantError);
  });
});

describe("in-memory OAuth state stays bounded", () => {
  it("drops expired entries from the access-token cache as tokens are verified", async () => {
    vi.useFakeTimers();
    try {
      const row = { id: "g1", user: "u1", client_id: "c1", scopes: "lifeline:read", access_hash: sha256("lla_a"), access_expires: later, resource: "" };
      const { admin } = fakeAdmin(row);
      const oauth = new LifelineOAuth(admin, "http://pb");
      const cache = (oauth as unknown as { verified: Map<string, unknown> }).verified;
      const first = oauth.verifyAccessToken("lla_a");
      await vi.advanceTimersByTimeAsync(10);
      await first;
      expect(cache.size).toBe(1);
      // Long after that entry expired, verifying any token sweeps it out.
      vi.setSystemTime(Date.now() + 10 * 60_000);
      const second = oauth.verifyAccessToken("lla_unknown").catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10);
      expect(await second).toBeInstanceOf(Error);
      expect(cache.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("limits sign-in attempts per address and forgets expired windows", () => {
    const limit = new LoginAttempts(2, 1_000);
    expect(limit.hit("a", 0)).toBe(true);
    expect(limit.hit("a", 1)).toBe(true);
    expect(limit.hit("a", 2)).toBe(false);
    expect(limit.hit("b", 3)).toBe(true);
    expect(limit.size).toBe(2);
    expect(limit.hit("c", 120_000)).toBe(true);
    expect(limit.size).toBe(1);
  });
});

/** A stand-in for the superuser client that records the mcp_clients rows it is asked to create. */
function clientsAdmin() {
  const create = vi.fn(async (row: unknown) => row);
  const admin = { collection: () => ({ create }) } as unknown as PocketBase;
  return { admin, create };
}

const register = async (oauth: LifelineOAuth, redirect_uris: string[]) =>
  oauth.clientsStore.registerClient!({ client_id: "new", client_name: "Claude", redirect_uris } as unknown as OAuthClientInformationFull);

describe("dynamic client registration", () => {
  it("registers claude.ai's and claude.com's connector callbacks", async () => {
    const { admin, create } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb");
    await register(oauth, ["https://claude.ai/api/mcp/auth_callback"]);
    await register(oauth, ["https://claude.com/api/mcp/auth_callback"]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("registers loopback callbacks on any port, as Claude Code uses", async () => {
    const { admin, create } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb");
    await register(oauth, ["http://localhost:53123/callback", "http://127.0.0.1:9/oauth/cb", "http://localhost/cb"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("registers ChatGPT's per-connector callback and its older single one", async () => {
    const { admin, create } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb");
    await register(oauth, ["https://chatgpt.com/connector/oauth/abc123", "https://chatgpt.com/connector_platform_oauth_redirect"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["another site", "https://evil.example/cb"],
    ["another path on claude.ai", "https://claude.ai/somewhere/else"],
    ["a look-alike host", "https://claude.ai.evil.example/api/mcp/auth_callback"],
    ["a host that starts like loopback", "http://localhost.evil.example:80/cb"],
    ["credentials hiding the real host", "http://localhost:80@evil.example/cb"],
    ["plain http to claude.ai", "http://claude.ai/api/mcp/auth_callback"],
    ["something that is not a URL", "not a url"],
    ["another path on chatgpt.com", "https://chatgpt.com/other"],
    ["the bare ChatGPT prefix", "https://chatgpt.com/connector/oauth/"],
    ["a dot segment out of the prefix", "https://chatgpt.com/connector/oauth/../../r?u=https://evil.example"],
    ["a fragment", "https://claude.ai/api/mcp/auth_callback#x"],
  ])("refuses %s with invalid_redirect_uri", async (_why, uri) => {
    const { admin, create } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb");
    const err = await register(oauth, ["https://claude.ai/api/mcp/auth_callback", uri]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect((err as OAuthError).toResponseObject().error).toBe("invalid_redirect_uri");
    expect(create).not.toHaveBeenCalled();
  });

  it("will not start a sign-in for a client registered earlier with a callback now refused", async () => {
    const { admin } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb");
    const sent: { status?: number; body?: string } = {};
    const res = {
      status(s: number) {
        sent.status = s;
        return this;
      },
      type() {
        return this;
      },
      send(b: string) {
        sent.body = b;
        return this;
      },
    } as unknown as Response;
    const old = { client_id: "old", client_name: "Claude", redirect_uris: ["https://evil.example/cb"] } as unknown as OAuthClientInformationFull;
    await oauth.authorize(old, { redirectUri: "https://evil.example/cb", codeChallenge: "x", state: "s" } as AuthorizationParams, res);
    expect(sent.status).toBe(400);
    expect(sent.body).not.toContain("password");
  });

  it("reads MCP_REDIRECT_ALLOW as a comma-separated list, defaulting when empty", () => {
    expect(parseRedirectAllow(" https://a.example/cb , http://localhost:* ")).toEqual(["https://a.example/cb", "http://localhost:*"]);
    expect(parseRedirectAllow(undefined)).toEqual(DEFAULT_REDIRECT_ALLOW);
    expect(parseRedirectAllow(" , ")).toEqual(DEFAULT_REDIRECT_ALLOW);
  });

  it("takes its allow-list from the configuration when one is given", async () => {
    const { admin, create } = clientsAdmin();
    const oauth = new LifelineOAuth(admin, "http://pb", ["https://my.client/cb"]);
    await register(oauth, ["https://my.client/cb"]);
    await expect(register(oauth, ["https://claude.ai/api/mcp/auth_callback"])).rejects.toBeInstanceOf(OAuthError);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("the consent page", () => {
  it("leaves Allow changes unticked, so write access is a deliberate choice", () => {
    const html = loginPage({ request: "r", clientName: "Claude", redirectUri: "https://claude.ai/api/mcp/auth_callback", write: true });
    const box = html.match(/<input type="checkbox" name="allow_write"[^>]*>/)?.[0];
    expect(box).toBeDefined();
    expect(box).not.toMatch(/\bchecked\b/);
  });
});

describe("redirectAllowed", () => {
  it("lets `:*` match any port and path on loopback only", () => {
    expect(redirectAllowed("http://localhost:1234/cb", ["http://localhost:*"])).toBe(true);
    expect(redirectAllowed("https://chatgpt.com/anything", ["https://chatgpt.com:*"])).toBe(false);
  });
  it("matches an exact entry exactly", () => {
    expect(redirectAllowed("https://chatgpt.com/other", ["https://chatgpt.com/connector_platform_oauth_redirect"])).toBe(false);
    expect(redirectAllowed("https://chatgpt.com/connector_platform_oauth_redirect", ["https://chatgpt.com/connector_platform_oauth_redirect"])).toBe(true);
  });
  it("matches a `/*` entry under its path, on its origin", () => {
    expect(redirectAllowed("https://chatgpt.com/connector/oauth/x1", ["https://chatgpt.com/connector/oauth/*"])).toBe(true);
    expect(redirectAllowed("https://chatgpt.com/connector/oauthx/x1", ["https://chatgpt.com/connector/oauth/*"])).toBe(false);
    expect(redirectAllowed("http://chatgpt.com/connector/oauth/x1", ["https://chatgpt.com/connector/oauth/*"])).toBe(false);
  });
});
