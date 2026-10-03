import { describe, expect, it } from "vitest";
import type { Line, Product, Receipt } from "./types";
import { cheapest, historyOf, latestUsual, matchProduct, median, normalizeLabel, observe, overallChange, receiptTitle, relabel, shopChanges, spanStart, sumOfLines, totalMismatch, unitPrice } from "./derive";

const product = (id: string, title: string, labels: Product["labels"] = []): Product => ({ id, type: "price_product", title, measure: "l", labels, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 }) as unknown as Product;
const receipt = (id: string, shopId: string, date: string, total = 0): Receipt => ({ id, type: "price_receipt", title: "", shopId, date, branch: "", total, tags: [], folder: "", createdAt: date, updatedAt: "", deleted: 0 }) as unknown as Receipt;
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
