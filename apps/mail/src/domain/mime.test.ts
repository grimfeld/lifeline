import { describe, expect, it } from "vitest";
import { decodeBody, decodeEntities, parseMessage, parseParties, summarizeThread } from "./mime";

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("decodeBody", () => {
  it("reads base64url without padding as UTF-8", () => {
    expect(decodeBody(b64url("héllo — wörld"))).toBe("héllo — wörld");
  });
  it("is empty for nothing", () => {
    expect(decodeBody(undefined)).toBe("");
  });
});

describe("parseParties", () => {
  it("reads names, addresses and quoted commas", () => {
    expect(parseParties('"Doe, Jane" <jane@x.io>, bob@y.io')).toEqual([
      { name: "Doe, Jane", address: "jane@x.io" },
      { name: "bob@y.io", address: "bob@y.io" },
    ]);
  });
});

describe("parseMessage", () => {
  const raw = {
    id: "m1",
    threadId: "t1",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Hello &amp; welcome",
    internalDate: "1700000000000",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "Subject", value: "Weekly digest" },
        { name: "From", value: "News <news@example.com>" },
        { name: "To", value: "me@example.com" },
      ],
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: b64url("Plain text") } },
            { mimeType: "text/html", body: { data: b64url("<p>Rich <b>text</b></p>") } },
          ],
        },
        { mimeType: "application/pdf", filename: "report.pdf", body: { attachmentId: "a1", size: 1234 } },
      ],
    },
  };
  it("takes both bodies, the attachments, the parties and the internal date", () => {
    const m = parseMessage(raw, "mb");
    expect(m.subject).toBe("Weekly digest");
    expect(m.from).toEqual({ name: "News", address: "news@example.com" });
    expect(m.html).toBe("<p>Rich <b>text</b></p>");
    expect(m.text).toBe("Plain text");
    expect(m.attachments).toEqual([{ id: "a1", filename: "report.pdf", mimeType: "application/pdf", size: 1234 }]);
    expect(m.date).toBe("2023-11-14T22:13:20.000Z");
    expect(m.snippet).toBe("Hello & welcome");
  });
});

describe("summarizeThread", () => {
  it("unions labels, orders senders oldest first and takes the newest date", () => {
    const s = summarizeThread(
      {
        id: "t",
        messages: [
          { id: "b", threadId: "t", labelIds: ["INBOX"], internalDate: "1700000100000", payload: { headers: [{ name: "From", value: "b@x.io" }, { name: "Subject", value: "Re: Hi" }] } },
          { id: "a", threadId: "t", labelIds: ["INBOX", "UNREAD", "STARRED"], internalDate: "1700000000000", payload: { headers: [{ name: "From", value: "a@x.io" }, { name: "Subject", value: "Hi" }] } },
        ],
      },
      "mb",
    );
    expect(s.subject).toBe("Hi");
    expect(s.from.map((p) => p.address)).toEqual(["a@x.io", "b@x.io"]);
    expect(s.date).toBe("2023-11-14T22:15:00.000Z");
    expect(s.unread).toBe(true);
    expect(s.starred).toBe(true);
    expect(s.labelIds.sort()).toEqual(["INBOX", "STARRED", "UNREAD"]);
    expect(s.messageCount).toBe(2);
  });
});

describe("decodeEntities", () => {
  it("unescapes what Gmail escapes in snippets", () => {
    expect(decodeEntities("a &lt;b&gt; &#39;c&#39; &quot;d&quot;")).toBe("a <b> 'c' \"d\"");
  });
});
