import { describe, expect, it } from "vitest";
import { hasMember, householdsForFamilyName, householdsOf, memberCandidates, memberIdsOn, membershipSpan, membershipsOf, membersOf, splitMembers } from "./households";
import { initApps } from "@lifeline/core";
import { householdTypeDef, personTypeDef } from "../types";
import { HOUSEHOLD } from "./types";

const people = [
  { id: "paul", title: "Paul Smith", aliases: ["Dad"], relationship: "my brother" },
  { id: "mary", title: "Mary Martin", aliases: [], relationship: "" },
  { id: "tom", title: "Tom Smith", aliases: [], relationship: "" },
];

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, householdTypeDef], screens: [], cards: [], commands: [] }]);

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

describe("whether a Person is a member", () => {
  it("is yes for anyone listed, past members too, whatever the stored shape", () => {
    const smiths = { id: "smiths", members: [{ personId: "paul" }, { personId: "tom", until: "2024-09-01" }] };
    expect([hasMember(smiths, "paul"), hasMember(smiths, "tom"), hasMember(smiths, "mary"), hasMember({ id: "odd", members: "paul" }, "paul")]).toEqual([true, true, false, false]);
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

  it("completes a candidate by their Given name too", () => {
    const mum = { id: "m", type: "contacts_person", title: "Mum", aliases: [], givenName: "Anne", relationship: "" };
    expect(memberCandidates({ members: [] }, [mum])).toEqual([{ value: "m", label: "Mum", keywords: ["Anne"] }]);
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

describe("who a Household stands for on a day (ADR 0117)", () => {
  const members = [{ personId: "paul" }, { personId: "mary", since: "2026-03-01" }, { personId: "tom", until: "2026-06-30" }];
  it("is whoever was a member that day, both bounds included", () => {
    expect(memberIdsOn(members, "2026-02-28")).toEqual(["paul", "tom"]);
    expect(memberIdsOn(members, "2026-03-01")).toEqual(["paul", "mary", "tom"]);
    expect(memberIdsOn(members, "2026-06-30")).toEqual(["paul", "mary", "tom"]);
    expect(memberIdsOn(members, "2026-07-01")).toEqual(["paul", "mary"]);
  });
  it("is what the Household type declares to the link index", () => {
    const declared = householdTypeDef.linkable as { members: (doc: unknown, day: string) => string[] };
    expect(declared.members({ members }, "2026-07-01")).toEqual(["paul", "mary"]);
    expect(declared.members({}, "2026-07-01")).toEqual([]);
  });
});

describe("who a Household stands for on a day (ADR 0117, the With picker)", () => {
  const members = (household: Record<string, unknown>, day: string) => {
    const l = householdTypeDef.linkable;
    return typeof l === "object" && l.members ? l.members({ id: "h", type: HOUSEHOLD, title: "the Smiths", ...household } as never, day) : null;
  };
  const smiths = { members: [{ personId: "paul" }, { personId: "tom", since: "2001-04-02", until: "2024-09-01" }, { personId: "lily", since: "2025-03-10" }] };

  it("is the Household's members on that day, since and until days included", () => {
    expect(members(smiths, "2026-11-15")).toEqual(["paul", "lily"]);
    expect(members(smiths, "2024-09-01")).toEqual(["paul", "tom"]);
    expect(members(smiths, "2001-04-02")).toEqual(["paul", "tom"]);
    expect(members(smiths, "2025-03-10")).toEqual(["paul", "lily"]);
  });

  it("leaves out someone not yet arrived or already gone", () => {
    expect(members(smiths, "2001-04-01")).toEqual(["paul"]);
    expect(members(smiths, "2024-09-02")).toEqual(["paul"]);
  });

  it("is no one for a Household with no members", () => {
    expect(members({}, "2026-11-15")).toEqual([]);
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

describe("former members (ADR 0117)", () => {
  const rows = [{ personId: "a" }, { personId: "b", until: "2026-06-30" }, { personId: "c", until: "2026-11-15" }, { personId: "d", since: "2027-01-01" }];
  it("are those whose until day has passed, still listed; the rest are members", () => {
    const { current, former } = splitMembers(rows, "2026-11-15");
    expect(former.map((r) => r.personId)).toEqual(["b"]);
    expect(current.map((r) => r.personId)).toEqual(["a", "c", "d"]);
  });
  it("say their days in a phrase", () => {
    expect(membershipSpan({})).toBe("");
    expect(membershipSpan({ since: "2001-04-02" })).toBe("since 2001-04-02");
    expect(membershipSpan({ since: "2001-04-02", until: "2024-09-01" })).toBe("since 2001-04-02 until 2024-09-01");
  });
  it("count on the first and last day of their stay and not outside it, a dateless source only for the unbounded", () => {
    const stay = [{ personId: "tom", since: "2020-01-01", until: "2024-09-01" }, { personId: "paul" }];
    expect(memberIdsOn(stay, "2019-12-31")).toEqual(["paul"]);
    expect(memberIdsOn(stay, "2020-01-01")).toEqual(["tom", "paul"]);
    expect(memberIdsOn(stay, "2024-09-01")).toEqual(["tom", "paul"]);
    expect(memberIdsOn(stay, "2024-09-02")).toEqual(["paul"]);
  });
});
