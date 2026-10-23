/**
 * `vercel.json`'s response headers, served by `vite preview` too, so the Demo's e2e
 * run (a production build, playwright.config.ts) loads under the same CSP and
 * headers as the deployed app. A `source` is read as Vercel reads a simple one: the
 * whole path, `(.*)` matching anything.
 *
 * The CSP names production's PocketBase. With VITE_PB_URL set to another one (a
 * local server), the preview swaps that origin in, so a build pointed at it can
 * still reach it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

export const PRODUCTION_PB = "https://lifeline-pb.fly.dev";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

export function vercelHeaders(root: string): HeaderRule[] {
  return (JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as { headers?: HeaderRule[] }).headers ?? [];
}

/** The headers Vercel would send for `pathname`, later rules winning. */
export function headersFor(rules: HeaderRule[], pathname: string, pbUrl?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules) {
    const source = new RegExp(`^${rule.source.replace(/[.+?^${}|[\]\\]/g, "\\$&").replace(/\(\\\.\*\)/g, ".*")}$`);
    if (!source.test(pathname)) continue;
    for (const { key, value } of rule.headers) out[key] = value;
  }
  const csp = out["Content-Security-Policy"];
  if (csp && pbUrl && new URL(pbUrl).origin !== PRODUCTION_PB) out["Content-Security-Policy"] = csp.replace(PRODUCTION_PB, new URL(pbUrl).origin);
  return out;
}

export function vercelHeadersPlugin(): Plugin {
  return {
    name: "lifeline-vercel-headers",
    configurePreviewServer(server) {
      const root = server.config.root;
      const rules = vercelHeaders(root);
      const pbUrl = loadEnv(server.config.mode, root, "VITE_").VITE_PB_URL;
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://preview").pathname;
        for (const [key, value] of Object.entries(headersFor(rules, pathname, pbUrl))) res.setHeader(key, value);
        next();
      });
    },
  };
}
