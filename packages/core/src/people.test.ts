import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "./registry";
import { documentsTable, putDocument } from "./documents/store";
import type { DocumentTypeDef } from "./documents/types";
import { PERSON_TYPE, peopleArg, peopleNamed } from "./people";

const person: DocumentTypeDef = { id: PERSON_TYPE, label: "People", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true };
initApps([{ id: "t", title: "T", types: [person], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("a People-links argument", () => {
  it("is a list of links to the Person type, its hint saying what it holds and how each is named", () => {
    expect(peopleArg("with", "With", "The People there")).toEqual({
      key: "with",
      label: "With",
      kind: "links",
      linkType: PERSON_TYPE,
      hint: "The People there: their name, an alias or an id; each must be only one Person.",
    });
  });
});

describe("the People a result names", () => {
  it("is the lead word, then each Person's name in order", async () => {
    await putDocument({ id: "p1", type: PERSON_TYPE, title: "Marc Lefèvre" });
    await putDocument({ id: "p2", type: PERSON_TYPE, title: "Zoé Martin" });
    expect(await peopleNamed("with", ["p2", "p1"])).toBe(" with Zoé Martin, Marc Lefèvre");
    expect(await peopleNamed("recommended by", ["p1"])).toBe(" recommended by Marc Lefèvre");
  });

  it("is nothing when there are no People, or none left", async () => {
    expect(await peopleNamed("for", [])).toBe("");
    expect(await peopleNamed("for", undefined)).toBe("");
    expect(await peopleNamed("for", ["gone"])).toBe("");
  });
});
