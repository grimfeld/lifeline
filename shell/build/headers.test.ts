import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { headersFor, PRODUCTION_PB, vercelHeaders } from "./headers";

const shell = path.resolve(import.meta.dirname, "..");
const repo = path.resolve(shell, "..");
const rules = vercelHeaders(shell);
const webCsp = headersFor(rules, "/")["Content-Security-Policy"];

/** A CSP as { directive: sources }. */
function parse(csp: string): Record<string, string[]> {
  return Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
}

describe("vercel.json headers", () => {
  it("sends the CSP and the hardening headers on every path, and keeps the Intakes CORS header", () => {
    for (const p of ["/", "/app/journal", "/intakes.json"]) {
      const h = headersFor(rules, p);
      expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
      expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    }
    expect(headersFor(rules, "/intakes.json")["Access-Control-Allow-Origin"]).toBe("*");
    expect(headersFor(rules, "/")["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("lets a preview pointed at another PocketBase reach it instead of production's", () => {
    const csp = parse(headersFor(rules, "/", "http://127.0.0.1:8090")["Content-Security-Policy"]);
    expect(csp["connect-src"]).toContain("http://127.0.0.1:8090");
    expect(csp["connect-src"]).not.toContain(PRODUCTION_PB);
    expect(parse(headersFor(rules, "/", PRODUCTION_PB)["Content-Security-Policy"])["connect-src"]).toContain(PRODUCTION_PB);
  });
});

describe("the desktop CSP", () => {
  it("is the web one, plus Tauri's IPC and without frame-ancestors (ignored outside a header)", () => {
    const conf = JSON.parse(readFileSync(path.join(shell, "src-tauri/tauri.conf.json"), "utf8"));
    const desktop = conf.app.security.csp as Record<string, string>;
    const web = parse(webCsp);
    delete web["frame-ancestors"];
    web["connect-src"] = ["ipc:", "http://ipc.localhost", ...web["connect-src"]];
    expect(Object.fromEntries(Object.entries(desktop).map(([k, v]) => [k, v.split(/\s+/)]))).toEqual(web);
  });
});

describe("connect-src", () => {
  /** Origins named in files that call fetch() but only ever shown as images or links, never fetched. */
  const NOT_FETCHED = new Set([
    "https://covers.openlibrary.org",
    "https://coverartarchive.org",
    "https://image.tmdb.org",
    "https://commons.wikimedia.org",
    "https://comicvine.gamespot.com", // fetched through fetchExternal, the proxy
  ]);

  it("names every origin the Apps and Core fetch directly", () => {
    const files = execFileSync("git", ["grep", "-l", "-F", "fetch(", "--", "apps/*/src/**", "packages/*/src/**", "shell/src/**", ":!*.test.*", ":!packages/extension/**"], { cwd: repo, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const origins = new Set(files.flatMap((f) => [...readFileSync(path.join(repo, f), "utf8").matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]+/g)].map((m) => m[0])));
    const allowed = parse(webCsp)["connect-src"];
    expect([...origins].filter((o) => !NOT_FETCHED.has(o) && !allowed.includes(o))).toEqual([]);
  });
});
