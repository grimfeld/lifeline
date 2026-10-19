// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isNewItem, parseFeed, seenUpToFor, sortFeedItems, type FeedItem } from "./rss";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>
<item><title>Second</title><link>https://b/2</link><guid>2</guid><pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hi &lt;b&gt;there&lt;/b&gt;&lt;/p&gt;</description></item>
<item><title>First</title><link>https://b/1</link><pubDate>Mon, 17 Aug 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom blog</title>
<entry><title>A</title><id>urn:a</id><link rel="alternate" href="https://a/1"/><updated>2026-08-18T09:00:00Z</updated><summary>s</summary></entry>
</feed>`;

describe("parseFeed", () => {
  it("rss 2.0", () => {
    const f = parseFeed(RSS);
    expect(f.title).toBe("Blog");
    expect(f.items.map((i) => i.title)).toEqual(["Second", "First"]);
    expect(f.items[0].id).toBe("2");
    expect(f.items[0].summary).toBe("Hi there");
    expect(f.items[1].id).toBe("https://b/1");
    expect(f.items[0].published).toBe("2026-08-18T10:00:00.000Z");
  });
  it("atom", () => {
    const f = parseFeed(ATOM);
    expect(f.title).toBe("Atom blog");
    expect(f.items[0]).toMatchObject({ id: "urn:a", title: "A", link: "https://a/1", published: "2026-08-18T09:00:00.000Z" });
  });
  it("rejects junk", () => {
    expect(() => parseFeed("<html><body>nope")).toThrow();
  });
  it("sort + new", () => {
    const f = parseFeed(RSS);
    const sorted = sortFeedItems([f.items[1], f.items[0]]);
    expect(sorted[0].title).toBe("Second");
    expect(isNewItem(sorted[0], "2026-08-17T12:00:00.000Z")).toBe(true);
    expect(isNewItem(sorted[1], "2026-08-17T12:00:00.000Z")).toBe(false);
    expect(isNewItem(sorted[1], null)).toBe(true);
  });
  it("seen up to now covers a future-dated item, so marking seen settles", () => {
    const item = (published: string | null) => ({ id: published ?? "x", title: "t", link: null, summary: "", published }) as FeedItem;
    const now = "2026-10-03T12:00:00.000Z";
    const future = item("2026-12-25T00:00:00.000Z");
    const upTo = seenUpToFor([item("2026-10-01T00:00:00.000Z"), future, item(null)], now);
    expect(upTo).toBe(future.published);
    expect(isNewItem(future, upTo)).toBe(false);
    expect(seenUpToFor([item("2026-10-01T00:00:00.000Z")], now)).toBe(now);
  });
});
