import { describe, expect, it } from "vitest";
import { findPerson, nameFromHandoff } from "./person";

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

describe("findPerson", () => {
  const anne = { title: "Anne Dupont", aliases: ["Mum"] };
  const anna = { title: "Anna", aliases: ["Mum", "Annie"] };
  const people = [anne, anna];
  it("finds one by name or alias, ignoring case and accents", () => {
    expect(findPerson(people, " anne dupont ")).toEqual({ person: anne });
    expect(findPerson(people, "ANNIE")).toEqual({ person: anna });
    expect(findPerson([{ title: "Léa" }], "lea")).toEqual({ person: { title: "Léa" } });
  });
  it("refuses an unknown name in words", () => {
    expect(findPerson(people, "Bob")).toEqual({ problem: "No Person called “Bob”" });
    expect(findPerson(people, "  ")).toHaveProperty("problem");
  });
  it("refuses an ambiguous name, naming those it could be", () => {
    expect(findPerson(people, "Mum")).toEqual({ problem: expect.stringMatching(/ambiguous: Anne Dupont, Anna/) });
  });
});
