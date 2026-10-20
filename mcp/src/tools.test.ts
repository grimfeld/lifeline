import { describe, expect, it } from "vitest";
import { commandToolName, TOOLS } from "./tools";
import { grantedScopes } from "./oauth";
import { unsyncedWrite } from "./devices";

describe("unsyncedWrite", () => {
  it("marks the write unconfirmed and never promises it will land", () => {
    const r = unsyncedWrite("PocketBase unreachable");
    expect(r.unconfirmed).toBe(true);
    expect(r.warning).toContain("PocketBase unreachable");
    expect(r.warning).toMatch(/lost if/);
    expect(r.warning).not.toMatch(/will be retried/);
  });
});

describe("tool catalogue", () => {
  it("names every tool within MCP's alphabet, without collisions", () => {
    const names = TOOLS.map((t) => t.name);
    for (const n of names) expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    expect(new Set(names).size).toBe(names.length);
    expect(commandToolName("calendar.add-event")).toBe("calendar_add_event");
  });

  it("exposes the headless Commands as write tools", () => {
    const add = TOOLS.find((t) => t.command === "tasks.add");
    expect(add?.write).toBe(true);
    expect(Object.keys(add!.input)).toEqual(expect.arrayContaining(["title", "date", "recurrence", "workspace"]));
  });

  it("hands an agent the receipt's Lines as rows, and the Products and Shops it may be missing (ADR 0075)", () => {
    const receipt = TOOLS.find((t) => t.name === "prices_receipt")!;
    expect(receipt.write).toBe(true);
    const lines = receipt.input.lines.safeParse([{ label: "LAIT 1/2 ECR", price: 1.09, amount: 6, promo: false }]);
    expect(lines.success).toBe(true);
    expect(receipt.input.lines.safeParse([{ label: "LAIT" }]).success).toBe(false);
    // A pack counted and weighed (ADR 0084): the second amount rides on the row, and on prices_add.
    expect(receipt.input.lines.safeParse([{ label: "CROISSANTS X4", price: 2.4, amount: 4, second_amount: 240, second_unit: "g" }]).success).toBe(true);
    expect(Object.keys(TOOLS.find((t) => t.name === "prices_add")!.input)).toEqual(expect.arrayContaining(["second_amount", "second_unit", "bought"]));
    expect(Object.keys(TOOLS.find((t) => t.name === "prices_product_add")!.input)).toEqual(expect.arrayContaining(["secondary_dimension", "secondary_unit", "compare_by"]));
    // The older measure arg still makes a Product: an agent written before ADR 0084 keeps working.
    const productAdd = TOOLS.find((t) => t.name === "prices_product_add")!;
    expect(productAdd.input.measure.safeParse("kg").success).toBe(true);
    expect(productAdd.input.dimension.safeParse(undefined).success).toBe(true);
    expect(TOOLS.map((t) => t.name)).toEqual(expect.arrayContaining(["prices_product_add", "prices_shop_add"]));
  });

  it("names Knowledge's tools after Knowledge, with no Languages aliases (ADR 0073)", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["knowledge_word", "knowledge_sentence"]));
    expect(names.filter((n) => n.startsWith("languages_"))).toEqual([]);
    expect(Object.keys(TOOLS.find((t) => t.name === "knowledge_word")!.input)).toEqual(expect.arrayContaining(["topic", "term", "meaning"]));
  });
});

describe("the guide tool", () => {
  const guide = TOOLS.find((t) => t.name === "guide")!;

  it("lists the pages, and reads one, with no Account (ADR 0089)", () => {
    expect(guide.write).toBe(false);
    const { pages } = guide.local!({}) as { pages: { page: string }[] };
    expect(pages.map((p) => p.page)).toEqual(expect.arrayContaining(["index", "money", "calendar", "connector"]));
    expect(guide.local!({ page: "money" })).toMatchObject({ page: "money", markdown: expect.stringMatching(/^# /m) });
    expect(guide.local!({ page: "nowhere" })).toMatchObject({ error: expect.any(String) });
  });
});

describe("grantedScopes", () => {
  it("always grants read, and write exactly when Allow changes is ticked", () => {
    expect(grantedScopes(true)).toEqual(["lifeline:read", "lifeline:write"]);
    expect(grantedScopes(false)).toEqual(["lifeline:read"]);
  });
});
