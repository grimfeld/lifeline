import { describe, expect, it } from "vitest";
import { decodeHandoff, encodeHandoff, handoffUrl } from "./index";

/** Base64url of a UTF-8 string, built independently of the codec. */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("a Handoff in a URL fragment", () => {
  it("comes back as it went, with the Intake it names", () => {
    const handoff = { title: "Booking confirmed", text: "Your table for **two**", url: "https://example.com/b?x=1&y=2#top", author: "Ada", date: "2026-10-18" };
    expect(decodeHandoff(encodeHandoff(handoff, "tasks/task"))).toEqual({ ok: true, handoff, intake: "tasks/task" });
  });

  it("names no Intake when the sender named none", () => {
    expect(decodeHandoff(encodeHandoff({ title: "A page", text: "" }))).toEqual({ ok: true, handoff: { title: "A page", text: "" } });
  });

  it("keeps unicode — accents, scripts, emoji, newlines", () => {
    const handoff = { title: "Café — 東京 🚀", text: "Zoë said:\n\n> «ça va» — مرحبا 👍🏽\n\n- one\n- two", author: "Zoë Ünal", date: "2026-10-18T09:30:00+02:00" };
    expect(decodeHandoff(encodeHandoff(handoff, "commonplace/quote"))).toEqual({ ok: true, handoff, intake: "commonplace/quote" });
  });

  it("keeps a very long text", () => {
    const text = "Lorem ipsum dolor sit amet, ünïcödé 🌍. ".repeat(20_000);
    const r = decodeHandoff(encodeHandoff({ title: "Long", text }));
    expect(r.ok && r.handoff.text).toBe(text);
  });

  it("fits in a URL: only fragment-safe characters", () => {
    expect(encodeHandoff({ title: "a/b?c#d&e=f +", text: "ÿ\u0000" }, "tasks/task")).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("is read with or without its #", () => {
    const f = encodeHandoff({ title: "T", text: "x" });
    expect(decodeHandoff(`#${f}`)).toEqual(decodeHandoff(f));
  });

  it("never carries an origin Document", () => {
    expect(decodeHandoff(encodeHandoff({ title: "T", text: "x", originId: "abc" }))).toEqual({ ok: true, handoff: { title: "T", text: "x" } });
  });

  it("makes the Handoff page's address", () => {
    const url = handoffUrl("https://lifeline.example/", { title: "T", text: "" }, "tasks/task");
    expect(url.startsWith("https://lifeline.example/handoff#v1.")).toBe(true);
    expect(decodeHandoff(new URL(url).hash)).toEqual({ ok: true, handoff: { title: "T", text: "" }, intake: "tasks/task" });
  });
});

describe("a fragment that is not a Handoff", () => {
  it("is empty", () => {
    expect(decodeHandoff("")).toEqual({ ok: false, error: "empty" });
    expect(decodeHandoff("#")).toEqual({ ok: false, error: "empty" });
  });

  it("comes from an unknown version", () => {
    expect(decodeHandoff(`v2.${b64('{"title":"T","text":""}')}`)).toEqual({ ok: false, error: "version" });
    expect(decodeHandoff("v0.abc")).toEqual({ ok: false, error: "version" });
  });

  it("is truncated", () => {
    const f = encodeHandoff({ title: "Booking confirmed", text: "Your table for two at eight", url: "https://example.com" });
    for (const cut of [4, 10, f.length - 3]) expect(decodeHandoff(f.slice(0, cut))).toEqual({ ok: false, error: "malformed" });
  });

  it("is garbage", () => {
    for (const g of ["hello", "v1.", "v1.!!!!", "v1.%E0%A4%A", "v1.a", `v1.${Buffer.from([0xff, 0xfe, 0x00]).toString("base64url")}`, "\u{1F680}"]) {
      expect(decodeHandoff(g)).toEqual({ ok: false, error: "malformed" });
    }
  });

  it("is JSON of the wrong shape", () => {
    for (const json of ["null", "42", '"T"', "[]", "{}", '{"title":"T"}', '{"title":1,"text":""}', '{"title":"T","text":""', '{"title":"T","text":"","url":5}', '{"title":"T","text":"","intake":["tasks/task"]}']) {
      expect(decodeHandoff(`v1.${b64(json)}`), json).toEqual({ ok: false, error: "malformed" });
    }
  });

  it("never throws, whatever it is given", () => {
    for (const x of [undefined, null, 42, {}, "v1.\uD800"] as unknown as string[]) expect(() => decodeHandoff(x)).not.toThrow();
  });
});
