import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type PocketBase from "pocketbase";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { LifelineOAuth } from "./oauth";

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
