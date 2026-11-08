import { describe, expect, it } from "vitest";
import { nameFromHandoff } from "./person";

describe("the name a Person is made with from a Handoff", () => {
  it("is the selected words when they are a name", () => {
    expect(nameFromHandoff({ title: "2026-11-08", text: " Anne Dupont ", originId: "d1" })).toBe("Anne Dupont");
  });

  it("is the Handoff's title when the text is no name: a paragraph, or several lines", () => {
    expect(nameFromHandoff({ title: "Anne Dupont", text: "Anne\nDupont" })).toBe("Anne Dupont");
    expect(nameFromHandoff({ title: "Profile", text: "x".repeat(81) })).toBe("Profile");
  });

  it("is the title when the text is empty", () => {
    expect(nameFromHandoff({ title: "Ada Lovelace — Wikipedia", text: "" })).toBe("Ada Lovelace — Wikipedia");
  });
});
