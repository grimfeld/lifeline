import { describe, expect, it } from "vitest";
import { isTypeable } from "./prompts";
import { FACT, SENTENCE, WORD } from "./types";

describe("which Prompts may be typed", () => {
  it("a Word's reverse and a Sentence's blank, not a forward, a Fact or another App's", () => {
    expect(isTypeable(WORD, "reverse")).toBe(true);
    expect(isTypeable(SENTENCE, "blank:ganas")).toBe(true);
    expect(isTypeable(WORD, "listen")).toBe(true);
    expect(isTypeable(SENTENCE, "listen")).toBe(true);
    expect(isTypeable(FACT, "listen")).toBe(false);
    expect(isTypeable(WORD, "forward")).toBe(false);
    expect(isTypeable(FACT, "forward")).toBe(false);
    expect(isTypeable("notes_quote", "reverse")).toBe(false);
  });
});
