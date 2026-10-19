// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readPage } from "./reader";

/** A page at `url` with `head` and `body`; `select` picks what the person selected in it. */
function page(url: string, head: string, body: string, select?: (doc: Document) => Range | null) {
  const { window } = new JSDOM(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, { url });
  const doc = window.document;
  const sel = window.getSelection()!;
  const range = select?.(doc);
  if (range) sel.addRange(range);
  return readPage(doc, sel);
}

describe("readPage", () => {
  it("with nothing selected sends the title and URL and an empty text", () => {
    expect(page("https://example.com/a", "<title> A page </title>", "<p>Body text</p>")).toEqual({
      title: "A page",
      text: "",
      url: "https://example.com/a",
    });
  });

  it("sends the selection as markdown, keeping links, emphasis and lists", () => {
    const body = `
      <p>Before.</p>
      <div id="s"><p>Read <em>this</em> and <strong>that</strong>, see <a href="/docs">the docs</a>.</p>
      <ul><li>one</li><li>two</li></ul></div>
      <p>After.</p>`;
    const h = page("https://example.com/post", "<title>Post</title>", body, (doc) => {
      const r = doc.createRange();
      r.selectNodeContents(doc.getElementById("s")!);
      return r;
    });
    expect(h.text).toBe("Read _this_ and **that**, see [the docs](https://example.com/docs).\n\n-   one\n-   two");
    expect(h.title).toBe("Post");
  });

  it("sends part of one paragraph as plain text, without the rest of the page", () => {
    const h = page("https://example.com/", "<title>T</title>", "<p id='p'>The quick brown fox</p>", (doc) => {
      const text = doc.getElementById("p")!.firstChild!;
      const r = doc.createRange();
      r.setStart(text, 4);
      r.setEnd(text, 15);
      return r;
    });
    expect(h.text).toBe("quick brown");
  });

  it("sends the author and date the page declares in its meta tags", () => {
    const head = `<title>Article</title>
      <meta name="author" content=" Ada Lovelace ">
      <meta property="article:published_time" content="2024-03-05T09:30:00Z">`;
    expect(page("https://news.example/a", head, "<p>x</p>")).toEqual({
      title: "Article",
      text: "",
      url: "https://news.example/a",
      author: "Ada Lovelace",
      date: "2024-03-05T09:30:00Z",
    });
  });

  it("falls back to article:author and datePublished", () => {
    const head = `<title>A</title>
      <meta property="article:author" content="Grace Hopper">
      <meta itemprop="datePublished" content="2023-11-02">`;
    const h = page("https://blog.example/", head, "");
    expect(h.author).toBe("Grace Hopper");
    expect(h.date).toBe("2023-11-02");
  });

  it("leaves author and date out when the page declares none, guessing nothing from the body", () => {
    const body = `<article><p class="byline">By Someone Else</p><time datetime="2022-01-01">1 Jan 2022</time></article>`;
    const h = page("https://example.com/", `<title>T</title><meta name="author" content="  ">`, body);
    expect(h).toEqual({ title: "T", text: "", url: "https://example.com/" });
  });

  it("reads a Gmail-like page as any other: only its title, its URL and the selection", () => {
    // Shaped like Gmail's reading pane: sender, address and date sit in the page, but in no meta tag.
    const head = `<title>Your booking is confirmed - ada@example.com - Gmail</title><meta name="application-name" content="Gmail">`;
    const body = `
      <div role="main">
        <h2 class="hP">Your booking is confirmed</h2>
        <span class="gD" email="bookings@hotel.example" name="Hotel Example">Hotel Example</span>
        <span class="g3" title="Mon, 4 Mar 2024, 10:12">4 Mar 2024</span>
        <div class="a3s"><div id="sel">Check-in <b>Friday 8 March</b> from 15:00.</div><div>Unsubscribe</div></div>
      </div>`;
    const h = page("https://mail.google.com/mail/u/0/#inbox/FMfcgz", head, body, (doc) => {
      const r = doc.createRange();
      r.selectNodeContents(doc.getElementById("sel")!);
      return r;
    });
    expect(h).toEqual({
      title: "Your booking is confirmed - ada@example.com - Gmail",
      text: "Check-in **Friday 8 March** from 15:00.",
      url: "https://mail.google.com/mail/u/0/#inbox/FMfcgz",
    });
  });
});
