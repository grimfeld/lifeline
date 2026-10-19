// node --test pocketbase/test/fetch_guard.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { blockedReason } = require("../pb_hooks/fetch_guard.js");

test("public hosts pass", () => {
  for (const url of [
    "https://example.com/feed.xml",
    "http://www.letterboxd.com/rss?x=1",
    "https://api.themoviedb.org:443/3/search",
    "https://user:pass@example.org/cal.ics",
    "https://8.8.8.8/",
    "https://172.32.0.1/",
    "https://EXAMPLE.COM./",
  ]) {
    assert.equal(blockedReason(url), "", url);
  }
});

test("loopback, private, link-local and reserved IPv4 are refused", () => {
  for (const url of [
    "http://127.0.0.1:8090/api/collections/users/records",
    "http://0.0.0.0/",
    "http://10.1.2.3/",
    "http://100.64.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://224.0.0.1/",
    "http://255.255.255.255/",
  ]) {
    assert.match(blockedReason(url), /private/, url);
  }
});

test("numeric tricks that resolvers read as IPs are refused", () => {
  for (const url of ["http://2130706433/", "http://0x7f.1/", "http://0177.0.0.1/", "http://127.1/", "http://127.0.0.01/", "http://999.1.1.1/"]) {
    assert.notEqual(blockedReason(url), "", url);
  }
});

test("private names and IPv6 literals are refused", () => {
  for (const url of [
    "http://localhost:8090/",
    "http://LOCALHOST./",
    "http://foo.localhost/",
    "http://lifeline-mcp.internal:8080/",
    "http://_api.internal:4280/",
    "http://printer.local/",
    "http://nas.home.arpa/",
    "http://pocketbase/",
    "http://[::1]/",
    "http://[fdaa::3]/",
    "http://[::ffff:127.0.0.1]/",
    "http://evil.com\\@127.0.0.1/",
    "http://x@127.0.0.1/",
  ]) {
    assert.notEqual(blockedReason(url), "", url);
  }
});
