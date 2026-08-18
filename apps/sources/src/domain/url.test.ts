import { describe, expect, it } from "vitest";
import { hostOf, normalizeEmbedUrl } from "./url";

describe("normalizeEmbedUrl", () => {
  it("accepts http(s) and adds https to bare hosts", () => {
    expect(normalizeEmbedUrl("https://a.b/c?d=1")).toBe("https://a.b/c?d=1");
    expect(normalizeEmbedUrl("http://localhost:3000/x")).toBe("http://localhost:3000/x");
    expect(normalizeEmbedUrl("  grafana.local/d/abc ")).toBe("https://grafana.local/d/abc");
  });
  it("rejects non-web schemes and junk", () => {
    expect(normalizeEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeEmbedUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeEmbedUrl("data:text/html,hi")).toBeNull();
    expect(normalizeEmbedUrl("")).toBeNull();
    expect(normalizeEmbedUrl("https://")).toBeNull();
  });
  it("hostOf", () => {
    expect(hostOf("https://grafana.example.com/d/abc?x=1")).toBe("grafana.example.com");
  });
});
