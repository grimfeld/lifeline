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

describe("blank hints", () => {
  it("reads answer|hint, the blank's text being the answer alone", () => {
    expect(parseCloze("Vado {{nel|in}} centro")).toEqual([
      { kind: "text", text: "Vado " },
      { kind: "blank", text: "nel", hint: "in", slot: "blank:nel" },
      { kind: "text", text: " centro" },
    ]);
  });

  it("adding, changing or removing a hint leaves the slot where it was", () => {
    const slots = (t: string) => blankSlots(t);
    expect(slots("Vado {{nel}} centro")).toEqual(["blank:nel"]);
    expect(slots("Vado {{nel|in}} centro")).toEqual(["blank:nel"]);
    expect(slots("Vado {{nel|dans le}} centro")).toEqual(["blank:nel"]);
  });

  it("keeps the numbering of a repeated answer whatever the hints", () => {
    expect(blankSlots("{{che|that}} sì, {{che}} no")).toEqual(["blank:che", "blank:che#2"]);
  });

  it("an empty hint is no hint; a blank with no answer stays text", () => {
    expect(parseCloze("{{nel|}}")).toEqual([{ kind: "blank", text: "nel", slot: "blank:nel" }]);
    expect(blankSlots("a {{|in}} b")).toEqual([]);
  });
});

describe("plainSentence", () => {
  it("never carries a hint", () => {
    expect(plainSentence("Vado {{nel|in}} centro")).toBe("Vado nel centro");
  });

  it("drops the markup", () => {
    expect(plainSentence("Tengo {{ganas}} de comer")).toBe("Tengo ganas de comer");
  });
});
