import { describe, expect, it } from "vitest";
import { QUICK_MAKE_MAX } from "@lifeline/core";
import { initialName, knownLine, nameFromHandoff } from "./person";

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

describe("a name exactly as long as a quick make allows", () => {
  it("is still a name; one letter more is not", () => {
    const name = "A".repeat(QUICK_MAKE_MAX);
    expect(nameFromHandoff({ title: "Page", text: name, originId: "d1" })).toBe(name);
    expect(nameFromHandoff({ title: "Page", text: `${name}A`, originId: "d1" })).toBe("Page");
  });
});

describe("the name the Add person dialog opens with", () => {
  it("comes from a Handoff when there is one, else from the initial values", () => {
    expect(initialName({ title: "Page", text: "Anne Dupont", originId: "d1" }, { name: "Ignored" })).toBe("Anne Dupont");
    expect(initialName(undefined, { name: "Léa" })).toBe("Léa");
    expect(initialName(undefined, undefined)).toBe("");
  });
});

describe("the line under a Person's name", () => {
  it("gives the age, the Relationship and the aliases, leaving out what is not known", () => {
    expect(knownLine(["Mum", "Maman"], 65)).toBe("65 years old · also Mum, Maman");
    expect(knownLine(["Mum"], null)).toBe("also Mum");
    expect(knownLine([], 0)).toBe("0 years old");
    expect(knownLine([], null)).toBe("");
  });
});
