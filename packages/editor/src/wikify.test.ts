import { describe, expect, it } from "vitest";
import { wikify } from "./wikify";

describe("wikify", () => {
  it("turns a wikilink into a wikilink: link and an image embed into an attachment: image", () => {
    expect(wikify("See [[Dune|the book]] and ![[cover.png]]")).toBe("See [the book](wikilink:Dune) and ![cover.png](attachment:cover.png)");
  });

  it("escapes a label's backslashes, so a trailing backslash cannot swallow the link", () => {
    expect(wikify("[[Dune|a\\]]")).toBe("[a\\\\](wikilink:Dune)");
  });

  it("reads a long run of brackets in linear time", () => {
    const text = '[["'.repeat(100_000);
    const started = performance.now();
    expect(wikify(text)).toBe(text);
    expect(wikify("[[a|".repeat(50_000))).toBe("[[a|".repeat(50_000));
    expect(wikify("[[a#".repeat(50_000))).toBe("[[a#".repeat(50_000));
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
