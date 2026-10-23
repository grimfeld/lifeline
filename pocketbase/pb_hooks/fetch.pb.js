/// <reference path="../pb_data/types.d.ts" />

// External fetch proxy (ADR 0017): GET /api/lifeline/fetch?url=<http(s) url>
// Signed-in users only. `headers` (JSON object) is forwarded to the target
// (API keys), never cookies. Public hosts only (fetch_guard.js). Capped in
// size and time. Returns the body verbatim with the upstream content-type.
//
// `$http.send` cannot stream: `res.raw` is the whole body, in memory before
// any check, and this VM shares 512 MB with the database. So the size is
// bounded before the body is read: a HEAD first refuses a declared
// Content-Length over the cap, and the GET asks for no more than the cap
// (Range). A server that both hides its length and ignores Range is still
// bounded only by the timeout.

routerAdd(
  "GET",
  "/api/lifeline/fetch",
  (e) => {
    // Handlers run in their own VM: constants must live inside.
    const MAX_BYTES = 2 * 1024 * 1024;
    const TIMEOUT_S = 10;
    const HEAD_TIMEOUT_S = 5;
    const url = e.request.url.query().get("url") || "";
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return e.json(400, { error: "url must be http(s)" });
    const blocked = require(`${__hooks}/fetch_guard.js`).blockedReason(url);
    if (blocked) return e.json(400, { error: blocked });
    const headers = { "User-Agent": "Lifeline/1.0 (+source fetch)" };
    const extra = e.request.url.query().get("headers") || "";
    if (extra) {
      try {
        const parsed = JSON.parse(extra);
        for (const k in parsed) if (typeof parsed[k] === "string" && !/^(cookie|host|range)$/i.test(k)) headers[k] = parsed[k];
      } catch (_) {
        return e.json(400, { error: "headers must be a JSON object" });
      }
    }
    const header = (res, name) => {
      const v = res.headers && (res.headers[name] || res.headers[name.toLowerCase()]);
      return Array.isArray(v) ? v[0] : v;
    };
    // A server that refuses or fumbles HEAD is not refused for it: the GET's Range still caps it.
    try {
      const head = $http.send({ url, method: "HEAD", headers, timeout: HEAD_TIMEOUT_S });
      if (Number(header(head, "Content-Length")) > MAX_BYTES) return e.json(413, { error: "response too large" });
    } catch (_) {}
    // One byte past the cap, so a server that honours Range still shows it had more.
    headers["Range"] = `bytes=0-${MAX_BYTES}`;
    let res;
    try {
      res = $http.send({ url, method: "GET", headers, timeout: TIMEOUT_S });
    } catch (err) {
      // The detail is ours to read, not the caller's: it can name addresses and internals.
      $app.logger().warn("fetch proxy: upstream failed", "url", url, "error", String(err));
      return e.json(502, { error: "upstream fetch failed" });
    }
    const body = res.raw || "";
    if (body.length > MAX_BYTES) return e.json(413, { error: "response too large" });
    e.response.header().set("Content-Type", String(header(res, "Content-Type") || "application/octet-stream"));
    e.response.header().set("X-Upstream-Status", String(res.statusCode));
    e.response.header().set("Cache-Control", "no-store");
    return e.string(res.statusCode >= 200 && res.statusCode < 300 ? 200 : 502, body);
  },
  $apis.requireAuth(),
);
