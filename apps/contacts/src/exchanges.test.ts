import { describe, expect, it } from "vitest";
import { buildLinkIndex, documentFigures, mentionDays, seenDays, timelineOf, type Document } from "@lifeline/core";
import { exchangeTypeDef, householdTypeDef, personTypeDef } from "./types";
import { exchangesOn } from "./daylog";

/** Where an Exchange stands among the rest (ADR 0131): on its People's Timeline, never as Seen or Mentioned. */
const doc = (d: Partial<Document> & { id: string; type: string; title: string }): Document => ({ body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "2026-01-01", deleted: 0, ...d });
const grandma = doc({ id: "g", type: "contacts_person", title: "Grandma", aliases: [], relationship: "my grandmother" });
const lucie = doc({ id: "l", type: "contacts_person", title: "Lucie", aliases: [], relationship: "my cousin" });
const call = doc({ id: "x", type: "contacts_exchange", title: "Call · Grandma", kind: "call", date: "2026-11-01", with: ["g"], body: "[[Lucie]] starts university in Lyon." });
const types = [personTypeDef, householdTypeDef, exchangeTypeDef];
const index = buildLinkIndex([grandma, lucie, call], types);

describe("an Exchange on the Timeline", () => {
  it("stands on each of its People's, via With, on its day", () => {
    expect(timelineOf(index, "g")).toEqual([expect.objectContaining({ sourceId: "x", title: "Call · Grandma", day: "2026-11-01", ownDay: true, field: "with" })]);
  });

  it("stands on the Timeline of someone its body names, as mentioned", () => {
    const [entry] = timelineOf(index, "l");
    expect(entry).toMatchObject({ sourceId: "x", day: "2026-11-01" });
    expect(entry!.field).toBeUndefined();
  });

  it("counts as neither Seen nor Mentioned, for those it is with or names", () => {
    for (const id of ["g", "l"]) {
      expect(seenDays(index, id, "2026-11-18")).toEqual([]);
      expect(mentionDays(index, id)).toEqual([]);
      expect(documentFigures(index, id, "2026-11-18").last).toBeUndefined();
    }
  });
});

describe("an Exchange in the Daylog", () => {
  const names = new Map([["g", "Grandma"], ["p", "Grandpa"]]);
  const x = (kind: string, withIds: string[], date = "2026-11-01") => doc({ id: `${kind}-${withIds.join()}`, type: "contacts_exchange", title: "", kind, date, with: withIds });
  const line = (e: Document) => exchangesOn([e], "2026-11-01", (id) => names.get(id)).map((l) => `${l.kind} ${l.title}`);

  it("is one line, worded by its kind", () => {
    expect(line(x("call", ["g"]))).toEqual(["Called Grandma"]);
    expect(line(x("video", ["g"]))).toEqual(["Video call with Grandma"]);
    expect(line(x("message", ["g"]))).toEqual(["Messaged Grandma"]);
    expect(line(x("letter", ["g"]))).toEqual(["Letter · Grandma"]);
  });

  it("joins its People, and says nobody once they are gone", () => {
    expect(line(x("call", ["g", "p"]))).toEqual(["Called Grandma, Grandpa"]);
    expect(line(x("call", []))).toEqual(["Called nobody"]);
  });

  it("is only on its own day", () => {
    expect(line(x("call", ["g"], "2026-10-31"))).toEqual([]);
  });
});
