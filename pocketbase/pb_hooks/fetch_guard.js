// Target guard for the fetch proxy (fetch.pb.js). Not a hook itself — only
// `*.pb.js` files are loaded as hooks — but required from the handler, and
// plain CommonJS so node can test it (pocketbase/test/fetch_guard.test.cjs).
//
// The proxy must reach the public web only: never this machine (loopback),
// Fly's private network (`*.internal`, 6PN fdaa::/16), link-local metadata
// addresses or a LAN. The JSVM can't resolve DNS, so the check is on the URL's
// host as written: IP literals are judged by range, names by suffix, and a
// numeric host that isn't a plain dotted quad (`2130706433`, `0x7f.1`, `0177.1`)
// is refused outright — resolvers read those as IPs. A public name that
// resolves or redirects to a private address is not caught here; `$http.send`
// follows redirects and exposes no hook to stop it.

// `.flycast` names are Fly's private load-balanced addresses (fdaa:…), like `.internal`.
const BLOCKED_SUFFIXES = [".localhost", ".internal", ".flycast", ".local", ".lan", ".home.arpa", ".intranet", ".corp"];

function hostOf(url) {
  const m = /^https?:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(url);
  return m ? m[1].toLowerCase().replace(/\.$/, "") : "";
}

function privateIPv4(parts) {
  const [a, b] = parts;
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // 192.0.0/24, 192.0.2/24 (IETF, TEST-NET-1)
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Why `url` may not be fetched, or "" when it may. */
function blockedReason(url) {
  const host = hostOf(url);
  if (!host) return "url has no host";
  // IPv6 literals: no public feed needs one, and the private ranges
  // (::1, fc00::/7, fe80::/10, fdaa:: on Fly, v4-mapped) are many.
  if (host.startsWith("[")) return "IP literal hosts are not allowed";
  if (!host.includes(".")) return "single-label hosts are not allowed";
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return "private hosts are not allowed";
  const last = host.slice(host.lastIndexOf(".") + 1);
  if (/^(0x[0-9a-f]*|\d+)$/.test(last)) {
    // Numeric: only a canonical dotted quad is read the same everywhere.
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m) return "non-canonical IP hosts are not allowed";
    const parts = m.slice(1).map(Number);
    if (parts.some((p, i) => p > 255 || (m[i + 1].length > 1 && m[i + 1][0] === "0"))) return "non-canonical IP hosts are not allowed";
    if (privateIPv4(parts)) return "private addresses are not allowed";
  }
  return "";
}

module.exports = { blockedReason };
