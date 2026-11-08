import { describe, expect, it } from "vitest";
import { sentencesUsing } from "./wordSentences";

const s = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, text, ...extra });
const ids = (term: string, list: ReturnType<typeof s>[]) => sentencesUsing(term, list).map((x) => x.id);

describe("sentencesUsing", () => {
  it("finds the term in a Sentence's plain text, blanks filled", () => {
    expect(ids("ganas", [s("a", "Tengo {{ganas}} de comer"), s("b", "Nada")])).toEqual(["a"]);
  });
  it("folds case but keeps accents", () => {
    expect(ids("Está", [s("a", "ESTÁ aquí"), s("b", "esta aquí")])).toEqual(["a"]);
    expect(ids("è", [s("a", "Lui è qui"), s("b", "Lui e qui")])).toEqual(["a"]);
  });
  it("matches whole words only, no stemming", () => {
    expect(ids("tavolo", [s("a", "Il tavolo è grande"), s("b", "I tavoli sono grandi"), s("c", "tavolotto")])).toEqual(["a"]);
    expect(ids("ana", [s("a", "banana")])).toEqual([]);
  });
  it("treats punctuation and apostrophes as boundaries", () => {
    expect(ids("amico", [s("a", "L'amico, appunto."), s("b", "amico!")])).toEqual(["a", "b"]);
  });
  it("matches a multi-word term as a phrase, spacing ignored", () => {
    expect(ids("tener ganas de", [s("a", "Quiero tener  ganas de nada"), s("b", "ganas de tener")])).toEqual(["a"]);
  });
  it("does not read the term as a pattern, and finds nothing for an empty one", () => {
    expect(ids("a.c", [s("a", "abc"), s("b", "a.c")])).toEqual(["b"]);
    expect(ids("  ", [s("a", "abc")])).toEqual([]);
  });
  it("keeps paused Sentences, as given", () => {
    expect(sentencesUsing("sí", [s("a", "Sí", { paused: true })])).toHaveLength(1);
  });
});
