import { describe, expect, it } from "vitest";
import { blankSlots, parseCloze, plainSentence } from "./cloze";

describe("parseCloze", () => {
  it("splits text and blanks, a blank known by its own text", () => {
    expect(parseCloze("Tengo {{ganas}} de {{comer}}.")).toEqual([
      { kind: "text", text: "Tengo " },
      { kind: "blank", text: "ganas", slot: "blank:ganas" },
      { kind: "text", text: " de " },
      { kind: "blank", text: "comer", slot: "blank:comer" },
      { kind: "text", text: "." },
    ]);
  });

  it("keeps a blank's slot when others are added, removed or reordered", () => {
    expect(blankSlots("{{Tengo}} {{ganas}} de comer")).toContain("blank:ganas");
    expect(blankSlots("de comer tengo {{ganas}}")).toEqual(["blank:ganas"]);
  });

  it("numbers the same text blanked twice", () => {
    expect(blankSlots("{{que}} sí, {{que}} no")).toEqual(["blank:que", "blank:que#2"]);
  });

  it("normalises case and spacing but keeps accents", () => {
    expect(blankSlots("{{ Él  está }}")).toEqual(["blank:él está"]);
  });

  it("leaves an empty pair of braces as text", () => {
    expect(blankSlots("a {{ }} b")).toEqual([]);
  });
});

describe("plainSentence", () => {
  it("drops the markup", () => {
    expect(plainSentence("Tengo {{ganas}} de comer")).toBe("Tengo ganas de comer");
  });
});
