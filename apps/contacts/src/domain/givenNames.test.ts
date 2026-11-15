import { describe, expect, it } from "vitest";
import { tidyCandidates, tidyPatch, tidyRowOf } from "./givenNames";

const P = (title: string, aliases: string[], givenName = "") => ({ id: title, title, givenName, aliases });

describe("tidy-up of given-name aliases", () => {
  it("proposes the alias a title begins with as the Given name, the rest as the Family name", () => {
    expect(tidyRowOf(P("Anne Dupont", ["Anne", "Annie"]))).toEqual({ id: "Anne Dupont", title: "Anne Dupont", givenName: "Anne", familyName: "Dupont", drop: ["Anne"] });
  });
  it("compares names as wikilinks do (case, accents, spacing) and whole words only", () => {
    expect(tidyRowOf(P("Élodie  Martin", ["elodie"]))?.familyName).toBe("Martin");
    expect(tidyRowOf(P("Annette Dupont", ["Ann"]))).toBeNull();
  });
  it("takes the longest alias and drops every copy of it", () => {
    const r = tidyRowOf(P("Anne Marie Dupont", ["Anne", "anne marie", "Anne Marie"]));
    expect(r).toMatchObject({ givenName: "anne marie", familyName: "Dupont", drop: ["anne marie", "Anne Marie"] });
  });
  it("skips People with a Given name or no leading alias", () => {
    expect(tidyCandidates([P("Anne Dupont", ["Anne"], "Anne"), P("Mum", ["Maman"]), P("Dr Okafor", [])])).toEqual([]);
  });
  it("lists candidates A to Z", () => {
    expect(tidyCandidates([P("Zoe K", ["Zoe"]), P("Al B", ["Al"])]).map((r) => r.title)).toEqual(["Al B", "Zoe K"]);
  });
  it("applies by filling the names and dropping only the duplicated alias", () => {
    expect(tidyPatch(P("Anne Dupont", ["Annie", "Anne", "Maman"]))).toEqual({ givenName: "Anne", familyName: "Dupont", aliases: ["Annie", "Maman"] });
  });
  it("leaves nothing to tidy once applied", () => {
    const p = P("Anne Dupont", ["Annie", "Anne"]);
    const patch = tidyPatch(p)!;
    expect(tidyCandidates([{ ...p, ...patch }])).toEqual([]);
    expect(tidyPatch({ ...p, ...patch })).toBeNull();
  });
});
