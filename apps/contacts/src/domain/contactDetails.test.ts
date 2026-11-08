import { describe, expect, it } from "vitest";
import type { ContactDetail } from "./types";
import { contactAction, contactDetailsOf, markFormer, saveDetail, validateDetail } from "./contactDetails";

const d = (over: Partial<ContactDetail>): ContactDetail => ({ id: "c1", label: "Mobile", kind: "phone", value: "", former: false, ...over });

describe("what a click does", () => {
  it("calls a phone number, keeping its + and digits", () => {
    expect(contactAction(d({ value: "+33 6 12 34 56 78" }))).toEqual({ href: "tel:+33612345678", external: false });
    expect(contactAction(d({ value: "(020) 7946-0018" }))).toEqual({ href: "tel:02079460018", external: false });
  });

  it("opens a new mail for an email address", () => {
    expect(contactAction(d({ kind: "email", value: " anne@example.org " }))).toEqual({ href: "mailto:anne@example.org", external: false });
  });

  it("opens a typed web address as it is, adding https:// when the scheme is left off", () => {
    expect(contactAction(d({ kind: "handle", value: "https://www.instagram.com/anne_p" }))).toEqual({ href: "https://www.instagram.com/anne_p", external: true });
    expect(contactAction(d({ kind: "handle", value: "instagram.com/anne_p" }))).toEqual({ href: "https://instagram.com/anne_p", external: true });
  });

  it("opens @handle on the service its label names", () => {
    expect(contactAction(d({ kind: "handle", label: "Instagram", value: "@anne_p" }))?.href).toBe("https://instagram.com/anne_p");
    expect(contactAction(d({ kind: "handle", label: "GitHub", value: "anne" }))?.href).toBe("https://github.com/anne");
    expect(contactAction(d({ kind: "handle", label: "Telegram", value: "@anne" }))?.href).toBe("https://t.me/anne");
    expect(contactAction(d({ kind: "handle", label: "X", value: "@anne" }))).toEqual({ href: "https://x.com/anne", external: true });
  });

  it("opens @user@host on the Mastodon server host", () => {
    expect(contactAction(d({ kind: "handle", label: "Fediverse", value: "@anne@mastodon.social" }))).toEqual({ href: "https://mastodon.social/@anne", external: true });
  });

  it("does nothing for a handle on a service it does not know, or for other schemes", () => {
    expect(contactAction(d({ kind: "handle", label: "Signal", value: "@anne.42" }))).toBeNull();
    expect(contactAction(d({ kind: "handle", value: "javascript:alert(1)" }))).toBeNull();
    expect(contactAction(d({ kind: "handle", value: "ftp://x.org/a" }))).toBeNull();
    expect(contactAction(d({ kind: "handle", label: "Instagram", value: "javascript:alert(1)" }))).toBeNull();
    expect(contactAction(d({ kind: "handle", value: "mailto:anne@example.org" }))).toBeNull();
    expect(contactAction(d({ kind: "handle", value: "data:text/html,x" }))).toBeNull();
  });

  it("does nothing for a value that is empty or not a number or address", () => {
    expect(contactAction(d({ value: "call after 5" }))).toBeNull();
    expect(contactAction(d({ value: "call 555 1234" }))).toBeNull();
    expect(contactAction(d({ kind: "email", value: "not an email" }))).toBeNull();
  });

  it("does nothing for a former one", () => {
    expect(contactAction(d({ value: "+33 6 12 34 56 78", former: true }))).toBeNull();
  });
});

describe("validating one", () => {
  it("needs a label and a value", () => {
    expect(validateDetail({ label: " ", kind: "phone", value: "1" })).toMatch(/label/i);
    expect(validateDetail({ label: "Mobile", kind: "phone", value: " " })).toMatch(/value|number/i);
    expect(validateDetail({ label: "Mobile", kind: "phone", value: "+1 555" })).toBeNull();
  });
});

describe("the list", () => {
  it("reads a row written before the key existed, or damaged, as empty or trimmed down", () => {
    expect(contactDetailsOf({})).toEqual([]);
    expect(contactDetailsOf({ contactDetails: "x" })).toEqual([]);
    expect(contactDetailsOf({ contactDetails: [d({}), null, { id: 3 }, { id: "z", label: "A", kind: "pager", value: "1" }] })).toEqual([d({})]);
    const ok = { id: "z", label: "A", kind: "phone", value: "1" };
    expect(contactDetailsOf({ contactDetails: [{ ...ok, id: 1 }, { ...ok, label: 1 }, { ...ok, value: 1 }, ok] })).toEqual([{ ...ok, former: false }]);
  });

  it("adds a new one with a fresh id, trimmed and current, at the end", () => {
    const next = saveDetail([d({ id: "c1" })], { label: " Work ", kind: "email", value: " a@b.c " }, () => "c2");
    expect(next[1]).toEqual({ id: "c2", label: "Work", kind: "email", value: "a@b.c", former: false });
  });

  it("edits one in place, keeping its id and place and whether it is former", () => {
    const list = [d({ id: "c1", former: true }), d({ id: "c2" })];
    const next = saveDetail(list, { id: "c1", label: "Old", kind: "phone", value: "9" });
    expect(next).toEqual([d({ id: "c1", label: "Old", value: "9", former: true }), list[1]]);
  });

  it("adds one whose id is no longer in the list, rather than edit nothing", () => {
    const next = saveDetail([d({ id: "c1" })], { id: "gone", label: "Work", kind: "phone", value: "9" }, () => "c9");
    expect(next.map((c) => c.id)).toEqual(["c1", "c9"]);
  });

  it("marks one former, or current again", () => {
    const list = [d({ id: "c1" }), d({ id: "c2" })];
    expect(markFormer(list, "c2", true)[1]?.former).toBe(true);
    expect(markFormer(markFormer(list, "c2", true), "c2", false)[1]?.former).toBe(false);
  });
});
