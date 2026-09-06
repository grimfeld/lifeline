// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { handoffOf, messageToMarkdown, tidy } from "./handoff";
import type { Message } from "./types";

const base: Message = {
  id: "m1",
  threadId: "t1",
  mailboxId: "mb",
  subject: "Weekly digest",
  from: { name: "News", address: "news@example.com" },
  to: [],
  cc: [],
  date: "2026-09-01T08:00:00.000Z",
  labelIds: [],
  snippet: "",
  html: "",
  text: "",
  attachments: [],
};

describe("messageToMarkdown", () => {
  it("converts HTML, dropping scripts, styles and tracking pixels", () => {
    const md = messageToMarkdown({
      html: `<html><head><style>p{color:red}</style></head><body><h1>Title</h1><p>Hello <b>there</b></p><img src="https://t.example/p.gif" width="1" height="1"><script>alert(1)</script><ul><li>one</li><li>two</li></ul></body></html>`,
      text: "",
    });
    expect(md).toBe("# Title\n\nHello **there**\n\n- one\n- two");
  });
  it("uses the plain text when there is no HTML", () => {
    expect(messageToMarkdown({ html: "", text: "Just text\n\n\n\nmore  " })).toBe("Just text\n\nmore");
  });
});

describe("handoffOf", () => {
  it("names the subject, the sender, the Gmail link and the sent date", () => {
    const h = handoffOf({ ...base, text: "Body" }, "me@example.com");
    expect(h).toEqual({
      title: "Weekly digest",
      text: "Body",
      url: "https://mail.google.com/mail/?authuser=me%40example.com#all/t1",
      author: "News",
      date: "2026-09-01T08:00:00.000Z",
    });
  });
  it("falls back to (no subject) and the address", () => {
    const h = handoffOf({ ...base, subject: "", from: { name: "", address: "x@y.io" } }, "me@example.com");
    expect(h.title).toBe("(no subject)");
    expect(h.author).toBe("x@y.io");
  });
});

describe("tidy", () => {
  it("collapses blank runs and nbsp", () => {
    expect(tidy("a b   \n\n\n\nc")).toBe("a b\n\nc");
  });
});
