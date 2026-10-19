import { describe, expect, it } from "vitest";
import type { Line, Product, Receipt } from "./types";
import { comparedBy, observe, observeAll } from "./derive";
import { overviewOf, overpaidOf, OVERPAID_WINDOW_DAYS, promoOf, rhythmOf, spanOf, spendOf, spreadOf } from "./stats";
const product = (id: string, title: string, labels: Product["labels"] = []): Product => ({ id, type: "price_product", title, measure: "l", labels, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 }) as unknown as Product;
const receipt = (id: string, shopId: string, date: string, total = 0, noticed = false): Receipt => ({ id, type: "price_receipt", title: "", shopId, date, branch: "", total, noticed, tags: [], folder: "", createdAt: date, updatedAt: "", deleted: 0 }) as unknown as Receipt;
const line = (id: string, receiptId: string, productId: string, price: number, amount = 1, promo = false): Line => ({ id, type: "price_line", title: "", receiptId, productId, label: "", amount, price, promo, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 }) as unknown as Line;

describe("span", () => {
  it("walks back whole months and clamps the day; 0 months is All", () => {
    expect(spanOf(3, "2026-09-04")).toEqual({ from: "2026-06-04", to: "2026-09-04" });
    expect(spanOf(1, "2026-03-31").from).toBe("2026-02-28");
    expect(spanOf(12, "2026-09-04").from).toBe("2025-09-04");
    expect(spanOf(0, "2026-09-04")).toEqual({ from: "", to: "2026-09-04" });
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

describe("Overview (spec #161, ADR 0084)", () => {
  const span = { from: "2026-01-01", to: "2026-06-30" };
  const products = [product("milk", "Milk"), product("eggs", "Eggs")];

  describe("per Shop", () => {
    const receipts = [
      receipt("r1", "lidl", "2026-01-10", 1000), // printed total beats the Lines' sum
      receipt("r2", "lidl", "2026-02-10"), // no printed total: the sum of its Lines, unmatched included
      receipt("r3", "aldi", "2026-03-01"),
      receipt("shelf", "aldi", "2026-03-05", 0, true), // a Sighting: no visit, no spend
      receipt("old", "aldi", "2025-12-01", 700), // before the span
    ];
    const lines = [
      line("a", "r1", "milk", 120),
      line("b", "r2", "milk", 110),
      line("c", "r2", "", 90),
      line("d", "r3", "milk", 100),
      line("e", "r3", "eggs", 300, 6),
      line("f", "shelf", "eggs", 240, 6),
      line("g", "old", "milk", 700),
    ];
    const shops = overviewOf(products, receipts, lines, span).shops;
    const of = (id: string) => shops.find((s) => s.shopId === id)!;

    it("spend is each bought Receipt's printed total, else the sum of its Lines", () => {
      expect(of("lidl").spent).toBe(1000 + 200);
      expect(of("aldi").spent).toBe(400);
    });
    it("visits count bought Receipts in the span, never a Sighting; the basket is spend over visits", () => {
      expect(of("lidl")).toMatchObject({ visits: 2, basket: 600 });
      expect(of("aldi")).toMatchObject({ visits: 1, basket: 400 });
    });
    it("counts the Products each Shop is cheapest for, a Sighting's price included", () => {
      expect(of("aldi").cheapestFor).toBe(2); // milk €1.00 against Lidl's latest €1.10; eggs €0.40 seen on the shelf
      expect(of("lidl").cheapestFor).toBe(0);
    });
    it("lists the Shops by spend, most first", () => {
      expect(shops.map((s) => s.shopId)).toEqual(["lidl", "aldi"]);
    });
  });

  it("Spend: every bought Line in the span, and the Products by spend with their share of it", () => {
    const receipts = [receipt("r1", "lidl", "2026-01-10", 9999), receipt("r2", "aldi", "2026-02-10"), receipt("shelf", "aldi", "2026-02-11", 0, true), receipt("old", "lidl", "2025-01-01")];
    const lines = [line("a", "r1", "milk", 100), line("b", "r1", "", 100), line("c", "r2", "eggs", 300), line("d", "r2", "milk", 100), line("e", "shelf", "eggs", 5000), line("f", "old", "milk", 5000)];
    const { spend } = overviewOf(products, receipts, lines, span);
    expect(spend.total).toBe(600); // the Lines, not the printed total; the unmatched one counted, the Sighting not
    expect(spend.top).toEqual([
      { productId: "eggs", spent: 300, share: 0.5 },
      { productId: "milk", spent: 200, share: 200 / 600 },
    ]);
  });

  describe("Overpaid and Promo saved", () => {
    const receipts = [receipt("a", "aldi", "2026-03-01"), receipt("b", "lidl", "2026-03-10"), receipt("c", "lidl", "2026-03-20")];
    const lines = [
      line("m1", "a", "milk", 100), // Aldi's usual milk €1.00
      line("m2", "b", "milk", 130), // Lidl: overpaid €0.30
      line("e1", "a", "eggs", 200, 4), // Aldi's usual eggs €0.50
      line("e2", "b", "eggs", 400, 4), // Lidl's usual eggs €1.00: overpaid €2.00
      line("e3", "c", "eggs", 240, 4, true), // promo at Lidl: €4.00 − €2.40 saved, and overpaid €0.40 against Aldi
    ];

    it("Overpaid: the total, and the Products overpaid most first, each with where it was cheapest", () => {
      const { overpaid } = overviewOf(products, receipts, lines, span);
      expect(overpaid.total).toBe(30 + 200 + 40);
      expect(overpaid.top).toEqual([
        { productId: "eggs", total: 240, cheapest: { shopId: "aldi", unit: 50, date: "2026-03-01" } },
        { productId: "milk", total: 30, cheapest: { shopId: "aldi", unit: 100, date: "2026-03-01" } },
      ]);
    });
    it("Promo saved: every Product's Promo saving over the span", () => {
      expect(overviewOf(products, receipts, lines, span).promoSaved).toBe(160);
    });
    it("reads each Product by its compared-by amount, so a Line without one is skipped", () => {
      // Eggs compared by weight, and no Line of them weighed: no Overpaid, no cheapest Shop for them.
      const weighed = products.map((p) => (p.id === "eggs" ? ({ ...p, dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "kg", compareBy: "secondary" } as Product) : p));
      const o = overviewOf(weighed, receipts, lines, span);
      expect(o.overpaid.top.map((t) => t.productId)).toEqual(["milk"]);
      expect(o.shops.find((s) => s.shopId === "aldi")!.cheapestFor).toBe(1);
    });
  });
});
