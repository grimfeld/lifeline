import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { quoteReading } from "./recallable";

const quote = (extra: Record<string, unknown> = {}) => ({ id: "q", type: "quote", title: "", tags: [], folder: "", createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "", deleted: 0, body: "Everything is fleeting.", source: "m1", ...extra }) as unknown as Document;

describe("a kept Quote through the Recallable Contract", () => {
  it("yields one Prompt, known by the Quote whatever its words", () => {
    expect(quoteReading.slots(quote())).toEqual(["passage"]);
    expect(quoteReading.slots(quote({ body: "Fixed wording." }))).toEqual(["passage"]);
  });

  it("is in Practice only while kept, and keeps its Topic when unkept", () => {
    expect(quoteReading.inPractice(quote({ kept: true, topic: "t" }))).toBe(true);
    expect(quoteReading.inPractice(quote({ kept: false, topic: "t" }))).toBe(false);
    expect(quoteReading.topicOf(quote({ kept: false, topic: "t" }))).toBe("t");
    expect(quoteReading.inPractice(quote())).toBe(false);
  });

  it("is new from when it was kept, and is its own origin", () => {
    expect(quoteReading.addedAt(quote({ keptAt: "2026-10-01T09:00:00.000Z" }))).toBe("2026-10-01T09:00:00.000Z");
    expect(quoteReading.addedAt(quote())).toBe("2026-08-19T00:00:00.000Z");
    expect(quoteReading.originOf?.(quote())).toBe("q");
  });
});
