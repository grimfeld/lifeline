import { describe, expect, it } from "vitest";
import { draftedValues, settleDraft } from "./fieldDraft";

describe("field draft", () => {
  it("shows the drafted value over the stored one until the Document catches up", () => {
    const fields = [{ key: "author" }, { key: "year" }];
    const draft = { author: "Ursula K" };
    expect(draftedValues(fields, { author: "Ursula", year: 1969 }, draft)).toEqual({ author: "Ursula K", year: 1969 });
  });

  it("keeps a key the stored Document has not caught up with", () => {
    const draft = { author: "Ursula K" };
    expect(settleDraft(draft, { author: "Ursula" })).toBe(draft);
  });

  it("drops a key once the stored Document holds it", () => {
    expect(settleDraft({ author: "Ursula K", year: 1970 }, { author: "Ursula K", year: 1969 })).toEqual({ year: 1970 });
  });

  it("compares arrays and blanks by value", () => {
    expect(settleDraft({ aliases: ["a", "b"], note: "" }, { aliases: ["a", "b"] })).toEqual({});
  });
});
