/// <reference path="../pb_data/types.d.ts" />

// External fetch proxy (ADR 0017): GET /api/lifeline/fetch?url=<http(s) url>
// Signed-in users only. `headers` (JSON object) is forwarded to the target
// (API keys), never cookies. Capped in size and
// time. Returns the body verbatim with the upstream content-type.

routerAdd(
  "GET",
  "/api/lifeline/fetch",
  (e) => {
    // Handlers run in their own VM: constants must live inside.
    const MAX_BYTES = 2 * 1024 * 1024;
    const TIMEOUT_S = 10;
    const url = e.request.url.query().get("url") || "";
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return e.json(400, { error: "url must be http(s)" });
    const headers = { "User-Agent": "Lifeline/1.0 (+source fetch)" };
    const extra = e.request.url.query().get("headers") || "";
    if (extra) {
      try {
        const parsed = JSON.parse(extra);
        for (const k in parsed) if (typeof parsed[k] === "string" && !/^(cookie|host)$/i.test(k)) headers[k] = parsed[k];
      } catch (_) {
        return e.json(400, { error: "headers must be a JSON object" });
      }
    }
    let res;
    try {
      res = $http.send({ url, method: "GET", headers, timeout: TIMEOUT_S });
    } catch (err) {
      return e.json(502, { error: String(err) });
    }
    const body = res.raw || "";
    if (body.length > MAX_BYTES) return e.json(413, { error: "response too large" });
    const ct = (res.headers && (res.headers["Content-Type"] || res.headers["content-type"])) || ["application/octet-stream"];
    e.response.header().set("Content-Type", Array.isArray(ct) ? ct[0] : String(ct));
    e.response.header().set("X-Upstream-Status", String(res.statusCode));
    e.response.header().set("Cache-Control", "no-store");
    return e.string(res.statusCode >= 200 && res.statusCode < 300 ? 200 : 502, body);
  },
  $apis.requireAuth(),
);
