import { describe, expect, it } from "vitest";
import type { Line, Product, Receipt } from "./types";
import { comparedBy, changesIn, overpaidOf, OVERPAID_WINDOW_DAYS, promoOf, spreadOf, observeAll, rhythmOf, spendOf, countsAsSpent, needingAmount, countsPerUnit, cheapest, historiesByProduct, historyOf, latestUsual, linesByReceipt, linesOf, matchProduct, median, normalizeLabel, observe, overallChange, overallOf, receiptTitle, relabel, shopChanges, spanStart, sumOfLines, totalMismatch, unitPrice } from "./derive";

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
  it("span start walks back whole months and clamps the day", () => {
    expect(spanStart(3, "2026-09-04")).toBe("2026-06-04");
    expect(spanStart(1, "2026-03-31")).toBe("2026-02-28");
    expect(spanStart(12, "2026-09-04")).toBe("2025-09-04");
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

describe("Product statistics (spec #161, ADR 0084)", () => {
  // Span: Jan–Jun 2026. Lidl and Aldi bought, a Sighting at Carrefour, one Line before the span.
  const span = { from: "2026-01-01", to: "2026-06-30" };
  const receipts = [
    receipt("old", "lidl", "2025-11-01"),
    receipt("r1", "lidl", "2026-01-10"),
    receipt("r2", "lidl", "2026-02-09"),
    receipt("r3", "aldi", "2026-03-11"),
    receipt("shelf", "carrefour", "2026-03-20", 0, true),
  ];
  const needs = (l: Line): Line => ({ ...l, needsAmount: true });
  const lines = [
    line("l0", "old", "p1", 300, 2),
    line("l1", "r1", "p1", 200, 2), // €1.00/unit
    line("l2", "r2", "p1", 160, 2, true), // promo €0.80, usual at Lidl €1.00
    line("l3", "r3", "p1", 270, 3), // €0.90
    needs(line("l4", "r3", "p1", 100, 1)), // needs an amount: spent, never per unit
    line("l5", "shelf", "p1", 50, 1), // a Sighting: €0.50, never spent
    line("u1", "r1", "", 230), // unmatched: in the share's whole, in no Product
    line("o1", "r2", "p2", 500), // another Product
    line("s2", "shelf", "p2", 9999), // a Sighting of another Product: no part of the whole
  ];
  const all = observeAll(lines, receipts);
  const obs = observe(lines, receipts);

  it("spend is what was paid for the Product in the span, needs-amount Lines included, Sightings never", () => {
    expect(spendOf("p1", all, span).spent).toBe(200 + 160 + 270 + 100);
  });
  it("share is over every bought Line in the span, unmatched included", () => {
    const s = spendOf("p1", all, span);
    expect(s.total).toBe(730 + 230 + 500);
    expect(s.share).toBeCloseTo(730 / 1460);
    expect(spendOf("p1", [], span).share).toBeNull();
  });

  it("rhythm: times bought counts buying occasions, not Lines, and never a Sighting", () => {
    const r = rhythmOf("p1", obs, span);
    expect(r.times).toBe(3); // r1, r2, r3 (two Lines on r3 are one occasion); the shelf is not
    expect(r.last).toBe("2026-03-11");
    expect(r.avgGapDays).toBe(30);
  });
  it("rhythm: amount per month is what was bought over the span's months, needs-amount Lines left out", () => {
    expect(rhythmOf("p1", obs, span).perMonth).toBeCloseTo(7 / 6, 1); // 2 + 2 + 3 over Jan–Jun
    // "All" runs from the first purchase: 9 over Nov–Jun.
    expect(rhythmOf("p1", obs, { from: "", to: "2026-06-30" }).perMonth).toBeCloseTo(9 / 8, 1);
  });
  it("rhythm: one purchase has no gap; none has nothing", () => {
    const one = rhythmOf("p2", obs, span);
    expect(one).toMatchObject({ times: 1, avgGapDays: null, last: "2026-02-09" });
    expect(rhythmOf("nope", obs, span)).toEqual({ times: 0, avgGapDays: null, last: null, perMonth: null });
  });

  it("spread: min / max / average / median unit price per Shop and across Shops — Sightings and promos in, needs-amount out", () => {
    const sp = spreadOf("p1", obs, span);
    expect(sp.overall).toEqual({ n: 4, min: 50, max: 100, avg: 80, median: 85 });
    expect(Object.fromEntries(sp.perShop.map((s) => [s.shopId, s.stats]))).toEqual({
      lidl: { n: 2, min: 80, max: 100, avg: 90, median: 90 },
      aldi: { n: 1, min: 90, max: 90, avg: 90, median: 90 },
      carrefour: { n: 1, min: 50, max: 50, avg: 50, median: 50 },
    });
    expect(sp.perShop.map((s) => s.shopId)).toEqual(["carrefour", "lidl", "aldi"]); // cheapest median first, then lowest min
    expect(spreadOf("nope", obs, span)).toEqual({ overall: null, perShop: [] });
  });

  it("promo: frequency over the prices seen, discount and saving against the same Shop's usual price before it", () => {
    const p = promoOf("p1", obs, span);
    expect(p).toEqual({ n: 4, promos: 1, frequency: 0.25, avgDiscount: 0.2, saving: 40 }); // l2: €1.00 usual × 2 − €1.60
  });
});

describe("Promo saving (CONTEXT.md)", () => {
  const span = { from: "2026-01-01", to: "2026-12-31" };
  const receipts = [
    receipt("a", "lidl", "2026-01-10"),
    receipt("b", "lidl", "2026-01-20"),
    receipt("c", "lidl", "2026-02-01"),
    receipt("d", "lidl", "2026-02-05", 0, true),
    receipt("e", "aldi", "2026-01-15"),
    receipt("f", "aldi", "2026-01-20"),
    receipt("g", "lidl", "2026-02-06"),
  ];
  const lines = [
    line("a1", "a", "p1", 100), // usual €1.00
    line("b1", "b", "p1", 140, 2, true), // promo €0.70: saved €2.00 − €1.40, 30% off
    line("c1", "c", "p1", 120), // usual €1.20 — after b1, so not its baseline
    line("d1", "d", "p1", 90, 1, true), // a promo Sighting: 25% off €1.20, saved nothing — not bought
    line("e1", "e", "p1", 50, 1, true), // promo at Aldi with no usual price there before it
    line("f1", "f", "p1", 60), // Aldi's usual comes later: not e1's baseline
    { ...line("g1", "g", "p1", 10, 1, true), needsAmount: true }, // needs an amount: not per unit, no saving
  ];
  const obs = observe(lines, receipts);

  it("measures each promo against the latest usual price at its own Shop on or before its day", () => {
    const p = promoOf("p1", obs, span);
    expect(p.n).toBe(6);
    expect(p.promos).toBe(3);
    expect(p.frequency).toBeCloseTo(0.5);
    expect(p.avgDiscount).toBeCloseTo(0.275); // (30% + 25%) / 2; e1 has no baseline
    expect(p.saving).toBe(60);
  });
  it("no promos, no discount", () => {
    expect(promoOf("nope", obs, span)).toEqual({ n: 0, promos: 0, frequency: null, avgDiscount: null, saving: 0 });
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

describe("Overpaid (CONTEXT.md)", () => {
  const span = { from: "2026-01-01", to: "2026-12-31" };

  it("what a bought Line paid beyond the cheapest usual price another Shop asked on or before its day", () => {
    const receipts = [receipt("a", "aldi", "2026-03-01"), receipt("b", "lidl", "2026-03-10")];
    const lines = [line("a1", "a", "p1", 100), line("b1", "b", "p1", 300, 2)]; // Aldi €1.00/u; Lidl paid €1.50/u × 2
    const o = overpaidOf("p1", observe(lines, receipts), span);
    expect(o.total).toBe(100);
    expect(o.cheapest).toEqual({ shopId: "aldi", unit: 100, date: "2026-03-01" });
  });

  it("ignores a price older than 90 days; one exactly 90 days old still counts", () => {
    expect(OVERPAID_WINDOW_DAYS).toBe(90);
    const receipts = [receipt("a", "aldi", "2026-01-01"), receipt("b", "lidl", "2026-04-01"), receipt("c", "lidl", "2026-04-02")]; // Apr 1 is 90 days after Jan 1
    const lines = [line("a1", "a", "p1", 100), line("b1", "b", "p1", 150), line("c1", "c", "p1", 170)];
    const o = overpaidOf("p1", observe(lines, receipts), span);
    expect(o.total).toBe(50); // c1's only other-Shop price is 91 days old
  });

  it("compares with other Shops only, never the same Shop's own cheaper day", () => {
    const receipts = [receipt("a", "lidl", "2026-03-01"), receipt("b", "lidl", "2026-03-10"), receipt("c", "aldi", "2026-02-25")];
    const lines = [line("a1", "a", "p1", 80), line("b1", "b", "p1", 150), line("c1", "c", "p1", 120)];
    const o = overpaidOf("p1", observe(lines, receipts), span);
    expect(o.total).toBe(30); // b1 against Aldi's €1.20, not Lidl's own €0.80; a1 beat Aldi; c1 came before any other Shop's price
  });

  it("judges a promo Line like any other, and never takes a promo as another Shop's price", () => {
    const receipts = [receipt("a", "aldi", "2026-03-01"), receipt("b", "aldi", "2026-03-02"), receipt("c", "lidl", "2026-03-10")];
    const lines = [line("a1", "a", "p1", 100), line("b1", "b", "p1", 50, 1, true), line("c1", "c", "p1", 130, 1, true)];
    const o = overpaidOf("p1", observe(lines, receipts), span);
    expect(o.total).toBe(30); // Lidl's promo €1.30 against Aldi's usual €1.00, not Aldi's €0.50 promo
    expect(o.cheapest).toEqual({ shopId: "aldi", unit: 100, date: "2026-03-01" });
  });

  it("a Sighting is a baseline but is never itself judged", () => {
    const receipts = [receipt("a", "aldi", "2026-03-01", 0, true), receipt("b", "lidl", "2026-03-10"), receipt("c", "lidl", "2026-03-11", 0, true)];
    const lines = [line("a1", "a", "p1", 100), line("b1", "b", "p1", 140), line("c1", "c", "p1", 500)];
    expect(overpaidOf("p1", observe(lines, receipts), span).total).toBe(40);
  });

  it("a Line that needs an amount is neither judged nor a baseline", () => {
    const receipts = [receipt("a", "aldi", "2026-03-01"), receipt("b", "aldi", "2026-03-02"), receipt("c", "lidl", "2026-03-10"), receipt("d", "lidl", "2026-03-11")];
    const lines = [line("a1", "a", "p1", 100), { ...line("b1", "b", "p1", 10), needsAmount: true }, line("c1", "c", "p1", 120), { ...line("d1", "d", "p1", 900), needsAmount: true }];
    expect(overpaidOf("p1", observe(lines, receipts), span).total).toBe(20);
  });

  it("reads the compared-by amount, and skips a Line without one, judged or as a baseline", () => {
    // Croissants compared by weight: the second amount (kg) by Line; a1 and c1 never had one weighed.
    const croissants = { ...product("p1", "Croissants"), dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "kg", compareBy: "secondary" } as Product;
    const weight: Record<string, number> = { b1: 0.5, d1: 0.25 };
    const receipts = [receipt("a", "aldi", "2026-03-01"), receipt("b", "aldi", "2026-03-02"), receipt("c", "lidl", "2026-03-10"), receipt("d", "lidl", "2026-03-11")];
    const lines = [line("a1", "a", "p1", 10, 4), line("b1", "b", "p1", 400, 4), line("c1", "c", "p1", 900, 4), line("d1", "d", "p1", 300, 4)].map((l) => ({ ...l, secondAmount: weight[l.id] }));
    const o = overpaidOf("p1", comparedBy(observe(lines, receipts), [croissants]), span);
    expect(o.total).toBe(100); // d1: €12/kg × 0.25 kg against Aldi's €8/kg
    expect(o.cheapest).toEqual({ shopId: "aldi", unit: 800, date: "2026-03-02" });
  });

  it("judges only Lines inside the span, against prices that may lie before it", () => {
    const receipts = [receipt("a", "aldi", "2025-12-20"), receipt("b", "lidl", "2025-12-25"), receipt("c", "lidl", "2026-01-05")];
    const lines = [line("a1", "a", "p1", 100), line("b1", "b", "p1", 900), line("c1", "c", "p1", 125)];
    expect(overpaidOf("p1", observe(lines, receipts), span)).toEqual({ total: 25, cheapest: { shopId: "aldi", unit: 100, date: "2025-12-20" } });
    expect(overpaidOf("p1", observe(lines, receipts), { from: "", to: "2026-12-31" }).total).toBe(825);
    expect(overpaidOf("nope", observe(lines, receipts), span)).toEqual({ total: 0, cheapest: undefined });
  });
});
