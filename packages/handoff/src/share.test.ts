import { describe, expect, it } from "vitest";
import { handoffFromShare } from "./index";

describe("what the share sheet hands over", () => {
  it("becomes a Handoff field for field", () => {
    expect(handoffFromShare({ title: "Booking confirmed", text: "Table for two at eight", url: "https://example.com/b/1" })).toEqual({
      title: "Booking confirmed",
      text: "Table for two at eight",
      url: "https://example.com/b/1",
    });
  });

  it("lifts a URL out of the text when no url came, as the origin", () => {
    expect(handoffFromShare({ title: "A good read", text: "Worth your time https://example.com/article?id=7 — trust me" })).toEqual({
      title: "A good read",
      text: "Worth your time — trust me",
      url: "https://example.com/article?id=7",
    });
  });

  it("leaves no text when the text was only the URL", () => {
    expect(handoffFromShare({ title: "A page", text: "  https://example.com/page  " })).toEqual({ title: "A page", text: "", url: "https://example.com/page" });
  });

  it("keeps the line breaks around a URL on its own line", () => {
    expect(handoffFromShare({ title: "T", text: "First line\nhttps://example.com/x\n\nLast paragraph" })).toEqual({
      title: "T",
      text: "First line\n\nLast paragraph",
      url: "https://example.com/x",
    });
  });

  it("does not take a sentence's full stop as part of the URL", () => {
    expect(handoffFromShare({ title: "T", text: "Read it at https://example.com/a." }).url).toBe("https://example.com/a");
  });

  it("lifts only the first URL; the others stay in the text", () => {
    expect(handoffFromShare({ title: "T", text: "https://one.example/a and https://two.example/b" })).toEqual({ title: "T", text: "and https://two.example/b", url: "https://one.example/a" });
  });

  it("keeps the text whole when a url came", () => {
    expect(handoffFromShare({ title: "T", text: "See https://other.example/z", url: "https://example.com/" })).toEqual({ title: "T", text: "See https://other.example/z", url: "https://example.com/" });
  });

  it("with no title, is titled by the URL's host", () => {
    expect(handoffFromShare({ text: "Have a look", url: "https://www.example.com/a/b?c=d" }).title).toBe("www.example.com");
  });

  it("with no title, is titled by the host of the URL lifted from the text", () => {
    expect(handoffFromShare({ title: "  ", text: "Have a look https://news.example.org/story/1" })).toEqual({ title: "news.example.org", text: "Have a look", url: "https://news.example.org/story/1" });
  });

  it("with no title and no URL, is titled by the text's first line", () => {
    expect(handoffFromShare({ text: "\n  Call the plumber  \nabout the sink, before Friday" })).toEqual({ title: "Call the plumber", text: "Call the plumber  \nabout the sink, before Friday" });
  });

  it("with nothing at all, is an empty Handoff", () => {
    expect(handoffFromShare({ title: null, text: null, url: null })).toEqual({ title: "", text: "" });
  });

  it("does not repeat the url as the text", () => {
    expect(handoffFromShare({ title: "T", text: "https://example.com/", url: "https://example.com/" })).toEqual({ title: "T", text: "", url: "https://example.com/" });
  });
});
