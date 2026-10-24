import { describe, expect, it } from "vitest";
import type { MacroShape } from "@lifeline/core";
import { commandToolName, macroTools, macroToolSpec, TOOLS } from "./tools";
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
    const lines = receipt.input.lines!.safeParse([{ label: "LAIT 1/2 ECR", price: 1.09, amount: 6, promo: false }]);
    expect(lines.success).toBe(true);
    expect(receipt.input.lines!.safeParse([{ label: "LAIT" }]).success).toBe(false);
    // A pack counted and weighed (ADR 0084): the second amount rides on the row, and on prices_add.
    expect(receipt.input.lines!.safeParse([{ label: "CROISSANTS X4", price: 2.4, amount: 4, second_amount: 240, second_unit: "g" }]).success).toBe(true);
    expect(Object.keys(TOOLS.find((t) => t.name === "prices_add")!.input)).toEqual(expect.arrayContaining(["second_amount", "second_unit", "bought"]));
    expect(Object.keys(TOOLS.find((t) => t.name === "prices_product_add")!.input)).toEqual(expect.arrayContaining(["secondary_dimension", "secondary_unit", "compare_by"]));
    // The older measure arg still makes a Product: an agent written before ADR 0084 keeps working.
    const productAdd = TOOLS.find((t) => t.name === "prices_product_add")!;
    expect(productAdd.input.measure!.safeParse("kg").success).toBe(true);
    expect(productAdd.input.dimension!.safeParse(undefined).success).toBe(true);
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

describe("Macro tools", () => {
  const add = {
    appId: "tasks",
    id: "add",
    title: "Add task",
    args: [
      { key: "title", label: "Title", kind: "text" as const, required: true },
      { key: "date", label: "Date", kind: "date" as const },
    ],
    invoke: async () => ({ message: "ok" }),
  };
  const today = { appId: "core", id: "today", title: "Go to Today", run: () => undefined };
  const macro = (id: string, name: string, steps: MacroShape["steps"]) => ({ id, name, steps });

  it("lists a headless Macro as a write tool whose arguments are its asked ones", () => {
    const [tool] = macroTools([macro("m1", "Plan a call", [{ command: "tasks/add", args: { title: { from: "asked" }, date: { from: "fixed", value: "2026-10-22" } } }])], [add]);
    expect(tool).toMatchObject({ name: "macro_plan_a_call", title: "Plan a call", macro: "m1" });
    const spec = macroToolSpec(tool!);
    expect(Object.keys(spec.input)).toEqual(["workspace", "s1_title"]);
    expect(spec).toMatchObject({ name: "macro_plan_a_call", macro: "m1", write: true });
    expect(spec.input.s1_title!.safeParse("call mum").success).toBe(true);
    expect(spec.input.s1_title!.safeParse(undefined).success).toBe(false);
    expect(spec.description).toContain("Add task");
  });

  it("leaves out a Macro that is not headless, and keeps names apart", () => {
    const tools = macroTools(
      [
        macro("m1", "Morning", [{ command: "core/today", args: {} }]),
        macro("m2", "Coffee!", [{ command: "tasks/add", args: { title: { from: "fixed", value: "x" } } }]),
        macro("m3", "coffee", [{ command: "tasks/add", args: { title: { from: "fixed", value: "y" } } }]),
      ],
      [add, today],
    );
    const names = tools.map((t) => t.name);
    // Two Macros named alike both go by their id: neither takes the other's name when one is renamed.
    expect(names).toEqual(["macro_coffee_m2", "macro_coffee_m3"]);
    for (const n of [...names, ...TOOLS.map((t) => t.name)]) expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it("offers list_macros to read-only connections, and create/update only with write", () => {
    const by = (n: string) => TOOLS.find((t) => t.name === n);
    expect(by("list_macros")?.write).toBe(false);
    expect(by("create_macro")?.write).toBe(true);
    expect(by("update_macro")?.write).toBe(true);
    expect(by("delete_macro")).toBeUndefined();
    expect(by("create_macro")!.input.steps!.safeParse([{ command: "tasks/add", args: { title: { from: "asked" }, date: { from: "step", step: 0 } }, skipIfRefused: true }]).success).toBe(true);
    expect(by("create_macro")!.input.steps!.safeParse([{ command: "tasks/add", args: { title: { from: "guess" } } }]).success).toBe(false);
  });
});
