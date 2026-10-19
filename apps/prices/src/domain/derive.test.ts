import { describe, expect, it } from "vitest";
import type { Line, Product, Receipt } from "./types";
import { comparedBy, changesIn, measureChange, observeAll, secondPrefill, unitPriceOn, countsAsSpent, needingAmount, countsPerUnit, cheapest, historiesByProduct, historyOf, latestUsual, linesByReceipt, linesOf, matchProduct, median, normalizeLabel, observe, overallChange, overallOf, receiptTitle, relabel, shopChanges, sumOfLines, totalMismatch, unitPrice } from "./derive";
import { spendOf, spreadOf } from "./stats";

const product = (id: string, title: string, labels: Product["labels"] = []): Product => ({ id, type: "price_product", title, measure: "l", labels, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 }) as unknown as Product;
const receipt = (id: string, shopId: string, date: string, total = 0, noticed = false): Receipt => ({ id, type: "price_receipt", title: "", shopId, date, branch: "", total, noticed, tags: [], folder: "", createdAt: date, updatedAt: "", deleted: 0 }) as unknown as Receipt;
const line = (id: string, receiptId: string, productId: string, price: number, amount = 1, promo = false): Line => ({ id, type: "price_line", title: "", receiptId, productId, label: "", amount, price, promo, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 }) as unknown as Line;

describe("labels", () => {
  it("normalises accents, case and whitespace", () => {
    expect(normalizeLabel("  Lait  demi-écrémé ")).toBe("LAIT DEMI-ECREME");
  });
  it("matches a remembered label at that shop only, then falls back to the product's own name", () => {
    const milk = product("p1", "Lait", [{ shopId: "lidl", label: "LAIT 1/2 ECR" }]);
    expect(matchProduct([milk], "lidl", "lait 1/2 ecr")?.id).toBe("p1");
    expect(matchProduct([milk], "carrefour", "LAIT 1/2 ECR")).toBeUndefined();
    expect(matchProduct([milk], "carrefour", "LAIT")?.id).toBe("p1");
    expect(matchProduct([milk], "carrefour", "")).toBeUndefined();
  });
});

describe("relabel", () => {
  it("two lines on one receipt matching one product both teach their label", () => {
    const milk = product("p1", "Lait");
    const out = relabel([milk], "lidl", "lidl", [
      { productId: "p1", label: "LAIT 1/2 ECR" },
      { productId: "p1", label: "LAIT UHT" },
    ]);
    expect(out.get("p1")).toEqual([
      { shopId: "lidl", label: "LAIT 1/2 ECR" },
      { shopId: "lidl", label: "LAIT UHT" },
    ]);
  });

  it("a line moved off a product forgets its label at the shop the receipt was at", () => {
    const milk = product("p1", "Lait", [{ shopId: "lidl", label: "LAIT UHT" }]);
    const cream = product("p2", "Creme");
    const out = relabel([milk, cream], "lidl", "aldi", [{ productId: "p2", label: "LAIT UHT", before: { productId: "p1", label: "LAIT UHT" } }]);
    expect(out.get("p1")).toEqual([]);
    expect(out.get("p2")).toEqual([{ shopId: "aldi", label: "LAIT UHT" }]);
  });

  it("nothing to learn writes nothing", () => {
    const milk = product("p1", "Lait", [{ shopId: "lidl", label: "LAIT UHT" }]);
    expect(relabel([milk], "lidl", "lidl", [{ productId: "p1", label: "lait uht" }, { productId: "p1", label: "Lait" }, { productId: "", label: "X" }]).size).toBe(0);
  });
});

describe("unit price", () => {
  it("divides the price paid by the amount; a missing amount counts as one", () => {
    expect(unitPrice({ price: 600, amount: 6 })).toBe(100);
    expect(unitPrice({ price: 129, amount: 0 })).toBe(129);
  });
});

describe("history", () => {
  const receipts = [receipt("r1", "lidl", "2026-01-10"), receipt("r2", "lidl", "2026-03-10"), receipt("r3", "carrefour", "2026-02-01"), receipt("r4", "lidl", "2026-04-01")];
  const lines = [line("l1", "r1", "p1", 100), line("l2", "r2", "p1", 120), line("l3", "r3", "p1", 110), line("l4", "r4", "p1", 80, 1, true), line("l5", "r1", "", 999), line("l6", "gone", "p1", 1)];
  const obs = observe(lines, receipts);

  it("joins matched lines with their receipt; unmatched and orphaned lines are dropped", () => {
    expect(obs.map((o) => o.line.id)).toEqual(["l1", "l2", "l3", "l4"]);
  });
  it("groups per shop, oldest first", () => {
    const h = historyOf("p1", obs);
    expect(h.get("lidl")?.map((p) => p.unit)).toEqual([100, 120, 80]);
    expect(h.get("carrefour")?.map((p) => p.unit)).toEqual([110]);
  });
  it("the usual price skips promo points", () => {
    const h = historyOf("p1", obs);
    expect(latestUsual(h.get("lidl")!)?.unit).toBe(120);
    expect(latestUsual([{ date: "2026-01-01", unit: 1, promo: true, lineId: "x", receiptId: "y" }])).toBeUndefined();
  });
  it("cheapest compares usual prices, never the promo", () => {
    expect(cheapest(historyOf("p1", obs))?.shopId).toBe("carrefour");
  });
});

describe("price change", () => {
  const receipts = [receipt("r1", "lidl", "2026-01-10"), receipt("r2", "lidl", "2026-03-10"), receipt("r3", "carrefour", "2026-02-01"), receipt("r4", "lidl", "2025-06-01")];
  const lines = [line("l1", "r1", "p1", 100), line("l2", "r2", "p1", 120), line("l3", "r3", "p1", 110), line("l4", "r4", "p1", 50), line("l5", "r1", "p2", 200), line("l6", "r2", "p2", 180)];
  const obs = observe(lines, receipts);

  it("is per shop, earliest to latest inside the span, and needs two points", () => {
    const c = shopChanges("p1", obs, "2026-01-01", "2026-12-31");
    expect(c).toHaveLength(1);
    expect(c[0].shopId).toBe("lidl");
    expect(c[0].pct).toBeCloseTo(20);
  });
  it("a shop switch is not inflation: nothing crosses shops", () => {
    expect(shopChanges("p1", obs, "2026-02-01", "2026-12-31")).toHaveLength(0);
  });
  it("the overall figure is the median across products' per-shop changes", () => {
    const o = overallChange(["p1", "p2"], obs, "2026-01-01", "2026-12-31");
    expect(o.n).toBe(2);
    expect(o.median).toBeCloseTo(5); // (+20 − 10) / 2
  });
  it("the one-pass groupings read the same as the per-product scans", () => {
    const all = historiesByProduct(obs);
    for (const id of ["p1", "p2"]) {
      expect(all.get(id)).toEqual(historyOf(id, obs));
      expect(changesIn(all.get(id)!, "2026-01-01", "2026-12-31")).toEqual(shopChanges(id, obs, "2026-01-01", "2026-12-31"));
    }
    expect(overallOf(["p1", "p2"].map((id) => changesIn(all.get(id)!, "2026-01-01", "2026-12-31")))).toEqual(overallChange(["p1", "p2"], obs, "2026-01-01", "2026-12-31"));
    const byReceipt = linesByReceipt(lines);
    for (const r of receipts) expect(byReceipt.get(r.id) ?? []).toEqual(linesOf(lines, r.id));
  });
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("receipt", () => {
  it("sums lines and flags a mismatch only against a printed total", () => {
    const ls = [line("a", "r", "", 100), line("b", "r", "", 250)];
    expect(sumOfLines(ls)).toBe(350);
    expect(totalMismatch({ total: 350 }, ls)).toBe(false);
    expect(totalMismatch({ total: 360 }, ls)).toBe(true);
    expect(totalMismatch({ total: 0 }, ls)).toBe(false);
  });
  it("titles as shop · day", () => {
    expect(receiptTitle("Lidl", "2026-09-04")).toMatch(/^Lidl · /);
    expect(receiptTitle("", "2026-09-04")).toMatch(/^Receipt · /);
  });
});

describe("Sightings (CONTEXT.md \"Sighting\")", () => {
  const receipts = [receipt("bought", "lidl", "2026-01-10", 250), receipt("shelf", "aldi", "2026-01-11", 0, true)];
  const lines = [line("l1", "bought", "p1", 100), line("l2", "shelf", "p1", 90)];
  const obs = observe(lines, receipts);

  it("an Observation carries its Receipt's noticed mark", () => {
    expect(obs.map((o) => [o.line.id, o.noticed])).toEqual([
      ["l1", false],
      ["l2", true],
    ]);
  });
  it("one shared filter: a Sighting counts per unit but never as spent", () => {
    expect(obs.filter(countsAsSpent).map((o) => o.line.id)).toEqual(["l1"]);
    expect(obs.filter(countsPerUnit).map((o) => o.line.id)).toEqual(["l1", "l2"]);
  });
  it("a noticed price still feeds history and the cheapest Shop", () => {
    expect(historyOf("p1", obs).get("aldi")?.map((p) => p.unit)).toEqual([90]);
    expect(cheapest(historyOf("p1", obs))?.shopId).toBe("aldi");
  });
});

describe("needs amount (CONTEXT.md \"Line\")", () => {
  const receipts = [receipt("r1", "lidl", "2026-01-10", 300), receipt("r2", "lidl", "2026-03-10", 300), receipt("r3", "aldi", "2026-02-01", 300)];
  const waiting = (l: Line): Line => ({ ...l, needsAmount: true });
  // Eggs went from pieces to kilograms: the Aldi Line and the later Lidl one still carry piece counts.
  const lines = [line("l1", "r1", "p1", 300, 0.6), waiting(line("l2", "r2", "p1", 360, 12)), waiting(line("l3", "r3", "p1", 200, 6))];
  const obs = observe(lines, receipts);

  it("still counts as spent but says nothing per unit", () => {
    expect(obs.filter(countsAsSpent).map((o) => o.line.id)).toEqual(["l1", "l2", "l3"]);
    expect(obs.filter(countsPerUnit).map((o) => o.line.id)).toEqual(["l1"]);
  });
  it("is kept out of history and the cheapest Shop", () => {
    const h = historyOf("p1", obs);
    expect([...h.keys()]).toEqual(["lidl"]);
    expect(h.get("lidl")?.map((p) => p.lineId)).toEqual(["l1"]);
    expect(cheapest(h)?.shopId).toBe("lidl");
    expect(historiesByProduct(obs).get("p1")).toEqual(h);
  });
  it("is kept out of the price change", () => {
    expect(shopChanges("p1", obs, "2026-01-01", "2026-12-31")).toEqual([]);
    expect(overallChange(["p1"], obs, "2026-01-01", "2026-12-31").n).toBe(0);
  });
  it("is counted for the inbox", () => {
    expect(needingAmount(lines).map((l) => l.id)).toEqual(["l2", "l3"]);
    expect(needingAmount([...lines, waiting(line("u", "r1", "", 50))]).map((l) => l.id)).toEqual(["l2", "l3"]);
  });
});

describe("compare-by (secondary Measure)", () => {
  // Croissants: counted, also weighed; compared by €/kg. Eggs: counted, weighed sometimes, compared by €/pc.
  const counted = (id: string, compareBy: "primary" | "secondary"): Product => ({ ...product(id, id), dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "kg", compareBy }) as Product;
  const croissants = counted("croissants", "secondary");
  const eggs = counted("eggs", "primary");
  const weighed = (id: string, receiptId: string, productId: string, price: number, amount: number, secondAmount?: number) => ({ ...line(id, receiptId, productId, price, amount), secondAmount }) as Line;
  const receipts = [receipt("r1", "lidl", "2026-01-10"), receipt("r2", "aldi", "2026-01-11"), receipt("r3", "lidl", "2026-02-10")];
  // Lidl: 4 croissants, 240 g, €2.40 → €0.60/pc, €10/kg. Aldi: 6 croissants, 300 g, €3.30 → €0.55/pc, €11/kg.
  const lines = [weighed("c1", "r1", "croissants", 240, 4, 0.24), weighed("c2", "r2", "croissants", 330, 6, 0.3), weighed("c3", "r3", "croissants", 200, 4), weighed("e1", "r1", "eggs", 360, 12, 0.72)];
  const obs = observe(lines, receipts);

  it("reads a Product compared by its secondary Measure per that unit, and its other Products per their own", () => {
    const read = comparedBy(obs, [croissants, eggs]);
    expect(cheapest(historyOf("croissants", read))).toMatchObject({ shopId: "lidl", point: { unit: 1000 } });
    expect(historyOf("eggs", read).get("lidl")!.map((p) => p.unit)).toEqual([30]);
  });

  it("leaves a Line without the second amount out of the secondary readings, still spent", () => {
    const read = comparedBy(obs, [croissants, eggs]);
    expect(historyOf("croissants", read).get("lidl")!.map((p) => p.lineId)).toEqual(["c1"]);
    expect(spreadOf("croissants", read, { from: "", to: "2026-12-31" }).overall?.n).toBe(2);
    expect(spendOf("croissants", comparedBy(observeAll(lines, receipts), [croissants]), { from: "", to: "2026-12-31" }).spent).toBe(770);
  });

  it("reads either basis on demand — the Product page's other figure", () => {
    expect(cheapest(historyOf("croissants", comparedBy(obs, [croissants], "primary")))).toMatchObject({ shopId: "lidl", point: { unit: 50, lineId: "c3" } });
    expect(historyOf("eggs", comparedBy(obs, [eggs], "secondary")).get("lidl")!.map((p) => p.unit)).toEqual([500]);
  });

  it("a Product with no secondary Measure always reads by its own", () => {
    const plain = { ...product("milk", "Milk"), dimension: "volume", unit: "L", countName: "", secondaryDimension: "", secondaryUnit: "kg", compareBy: "secondary" } as Product;
    const milk = observe([line("m1", "r1", "milk", 109, 1)], receipts);
    expect(comparedBy(milk, [plain], "secondary")).toEqual(milk);
  });
});

describe("a Line's unit price on a basis (the Product page's every-price list)", () => {
  const croissants = { ...product("c", "Croissants"), dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" } as Product;
  const [o] = observe([{ ...line("c1", "r1", "c", 240, 4), secondAmount: 0.24 } as Line], [receipt("r1", "lidl", "2026-01-10")]);
  const [bare] = observe([line("c2", "r1", "c", 200, 4)], [receipt("r1", "lidl", "2026-01-10")]);

  it("reads the compared-by basis by default, the other on demand", () => {
    expect(unitPriceOn(o, croissants)).toBe(1000);
    expect(unitPriceOn(o, croissants, "primary")).toBe(60);
  });
  it("says nothing without the amount for that basis, nor while the Line needs an amount", () => {
    expect(unitPriceOn(bare, croissants)).toBeNull();
    expect(unitPriceOn(bare, croissants, "primary")).toBe(50);
    expect(unitPriceOn({ ...o, line: { ...o.line, needsAmount: true } }, croissants, "primary")).toBeNull();
  });
});

describe("what a Measure change or merge does to the Lines, said beforehand", () => {
  const eggs = { ...product("e", "Eggs"), dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "primary" } as Product;
  const lines = [{ ...line("e1", "r1", "e", 360, 12), secondAmount: 0.72 } as Line, line("e2", "r1", "e", 199, 6), line("x", "r1", "other", 100)];

  it("a new reading unit or compare-by touches nothing", () => {
    expect(measureChange(eggs, { dimension: "count", secondaryDimension: "mass" }, lines)).toEqual({ retype: 0, cleared: 0 });
  });
  it("a new dimension sends every Line to be retyped, and takes the secondary Measure's amounts with it", () => {
    expect(measureChange(eggs, { dimension: "mass", secondaryDimension: "mass" }, lines)).toEqual({ retype: 2, cleared: 1 });
  });
  it("dropping the secondary Measure clears only the second amounts", () => {
    expect(measureChange(eggs, { dimension: "count", secondaryDimension: "" }, lines)).toEqual({ retype: 0, cleared: 1 });
  });
});

describe("a new Line's second amount, prefilled", () => {
  const croissants = { ...product("c", "Croissants"), dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" } as Product;
  const obs = observe([{ ...line("c1", "r1", "c", 240, 4), secondAmount: 0.24 } as Line, { ...line("c2", "r2", "c", 250, 4), secondAmount: 0.25 } as Line], [receipt("r1", "lidl", "2026-01-10"), receipt("r2", "aldi", "2026-01-11")]);

  it("is the last one at the Shop, in the secondary Measure's reading unit", () => {
    expect(secondPrefill(obs, croissants, "lidl")).toBe(240);
    expect(secondPrefill(obs, croissants, "aldi")).toBe(250);
    expect(secondPrefill(obs, croissants, "carrefour")).toBeUndefined();
    expect(secondPrefill(obs, { ...croissants, secondaryDimension: "" }, "lidl")).toBeUndefined();
  });
});
