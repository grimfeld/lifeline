import { pb } from "./data/pb";
import { isExternalUrl } from "./external";
import { isDemo } from "./demo";

/**
 * Fetch an external URL for a Source (ADR 0017): natively under Tauri (no
 * CORS), else through the authenticated PocketBase proxy route. Text bodies
 * only (feeds, iCal, JSON, HTML). Never sends cookies; `headers` are the
 * Source's own (API keys).
 */
export interface ExternalResponse {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
}

export interface ExternalFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function fetchExternal(url: string, opts: ExternalFetchOptions = {}): Promise<ExternalResponse> {
  if (!isExternalUrl(url)) throw new Error("Only http(s) URLs can be fetched");
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      const res = await tauriFetch(url, {
        method: "GET",
        headers: { "User-Agent": "Lifeline/1.0 (+source fetch)", ...(opts.headers ?? {}) },
        signal: ctrl.signal,
        redirect: "follow",
      });
      return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? "", body: await res.text() };
    }
    // The browser's way out goes through the backend, which the Demo has none of (ADR 0077).
    if (isDemo()) return { ok: false, status: 0, contentType: "", body: "Fetching from the web is not available in the Demo" };
    const q = new URLSearchParams({ url });
    if (opts.headers && Object.keys(opts.headers).length) q.set("headers", JSON.stringify(opts.headers));
    const res = await fetch(`${pb.baseURL.replace(/\/$/, "")}/api/lifeline/fetch?${q}`, {
      headers: pb.authStore.token ? { Authorization: pb.authStore.token } : {},
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      let msg = body;
      try {
        msg = (JSON.parse(body) as { error?: string }).error ?? body;
      } catch {
        /* keep raw */
      }
      const upstream = Number(res.headers.get("x-upstream-status") ?? res.status);
      return { ok: false, status: upstream || res.status, contentType: "", body: msg };
    }
    return { ok: true, status: 200, contentType: res.headers.get("content-type") ?? "", body };
  } finally {
    clearTimeout(timer);
  }
}
