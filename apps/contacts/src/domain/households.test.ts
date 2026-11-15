import { describe, expect, it } from "vitest";
import { householdsForFamilyName, householdsOf, memberCandidates, membershipsOf, membersOf } from "./households";

const people = [
  { id: "paul", title: "Paul Smith", aliases: ["Dad"], relationship: "my brother" },
  { id: "mary", title: "Mary Martin", aliases: [], relationship: "" },
  { id: "tom", title: "Tom Smith", aliases: [], relationship: "" },
];

describe("a Household's memberships (ADR 0117)", () => {
  it("reads each stored membership, with its since and until days when they are days", () => {
    expect(membershipsOf([{ personId: "paul" }, { personId: "tom", since: "2001-04-02", until: "2024-09-01" }, { personId: "mary", since: "soon" }])).toEqual([
      { personId: "paul" },
      { personId: "tom", since: "2001-04-02", until: "2024-09-01" },
      { personId: "mary" },
    ]);
  });

  it("reads what is no membership as none, and a Person listed twice once", () => {
    expect(membershipsOf(undefined)).toEqual([]);
    expect(membershipsOf("paul")).toEqual([]);
    expect(membershipsOf([null, { personId: "" }, { personId: 3 }, { personId: "paul" }, { personId: "paul", since: "2020-01-01" }])).toEqual([{ personId: "paul" }]);
  });
});

describe("a Household's members as its page shows them", () => {
  it("names each member visible here, A to Z, and leaves out anyone no longer among the People", () => {
    const members = membersOf({ members: [{ personId: "tom" }, { personId: "gone" }, { personId: "mary", since: "2010-06-12" }] }, people);
    expect(members).toEqual([
      { personId: "mary", name: "Mary Martin", since: "2010-06-12" },
      { personId: "tom", name: "Tom Smith" },
    ]);
  });

  it("offers as new members only the People not in it yet, found by name or alias", () => {
    expect(memberCandidates({ members: [{ personId: "mary" }] }, people)).toEqual([
      { value: "paul", label: "Paul Smith", keywords: ["Dad"], description: "my brother" },
      { value: "tom", label: "Tom Smith", keywords: [] },
    ]);
  });
});

describe("a Person's Households", () => {
  const smiths = { id: "h1", title: "the Smiths", members: [{ personId: "paul" }, { personId: "tom" }] };
  const flat = { id: "h2", title: "Student flat", members: [{ personId: "tom" }] };

  it("are every Household that holds them, A to Z: someone may belong to several", () => {
    expect(householdsOf("tom", [smiths, flat]).map((h) => h.title)).toEqual(["Student flat", "the Smiths"]);
    expect(householdsOf("paul", [smiths, flat]).map((h) => h.id)).toEqual(["h1"]);
    expect(householdsOf("mary", [smiths, flat])).toEqual([]);
  });
});

describe("the Households suggested for a Family name (ADR 0117)", () => {
  const folks = [
    { id: "paul", familyName: "Smith" },
    { id: "mary", familyName: "Martin" },
    { id: "ana", familyName: "" },
  ];
  const smiths = { title: "the Smiths", members: [{ personId: "paul" }] };
  const martins = { title: "Martin & co", members: [{ personId: "mary" }, { personId: "ana" }] };
  const empty = { title: "Empty", members: [] };

  it("offers a Household with a member of that Family name, names compared as links are", () => {
    expect(householdsForFamilyName("smith", [smiths, martins, empty], folks)).toEqual([smiths]);
    expect(householdsForFamilyName("  SMÏTH ", [smiths, martins], folks)).toEqual([smiths]);
  });

  it("offers a Household once however many of its members match, A to Z, and none for a name nobody has or none at all", () => {
    const flat = { title: "Flat", members: [{ personId: "paul" }, { personId: "mary" }] };
    expect(householdsForFamilyName("Smith", [smiths, flat], folks).map((h) => h.title)).toEqual(["Flat", "the Smiths"]);
    expect(householdsForFamilyName("Jones", [smiths], folks)).toEqual([]);
    expect(householdsForFamilyName("  ", [smiths, martins], folks)).toEqual([]);
  });

  it("ignores a member who is not among the People visible", () => {
    expect(householdsForFamilyName("Smith", [smiths], [])).toEqual([]);
  });
});
