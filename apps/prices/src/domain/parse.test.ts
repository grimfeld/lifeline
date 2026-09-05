import { describe, expect, it } from "vitest";
import { findDate, findShop, parseReceiptText } from "./parse";

const SAMPLE = `LIDL
12 RUE DE LA PAIX
75002 PARIS
04/09/2026 18:32

LAIT DEMI-ECREME 1L        0,89 A
BANANES
  0,842 kg x 1,79 €/kg     1,51 A
PIZZA MARGHERITA
2 x 2,99                   5,98 B
REMISE PIZZA              -1,00
YAOURT NATURE X4           1,29 A
SOUS-TOTAL                 9,67
TOTAL                      8,67
CARTE BANCAIRE             8,67
TVA A 5,5%                 0,20
MERCI DE VOTRE VISITE`;

describe("parseReceiptText", () => {
  const draft = parseReceiptText(SAMPLE, [{ id: "lidl", title: "Lidl" }, { id: "cf", title: "Carrefour" }]);

  it("finds the shop and the day", () => {
    expect(draft.shopId).toBe("lidl");
    expect(draft.date).toBe("2026-09-04");
  });
  it("keeps only priced product rows, skipping bookkeeping", () => {
    expect(draft.lines.map((l) => l.label)).toEqual(["LAIT DEMI-ECREME 1L", "BANANES", "PIZZA MARGHERITA", "YAOURT NATURE X4"]);
  });
  it("reads a weighed amount from a quantity row", () => {
    const bananas = draft.lines[1];
    expect(bananas.amount).toBeCloseTo(0.842);
    expect(bananas.price).toBe(151);
  });
  it("folds a discount into the previous line and flags it promo", () => {
    const pizza = draft.lines[2];
    expect(pizza.amount).toBe(2);
    expect(pizza.price).toBe(498);
    expect(pizza.promo).toBe(true);
    expect(draft.lines[0].promo).toBe(false);
  });
  it("takes the TOTAL, not the sub-total", () => {
    expect(draft.total).toBe(867);
  });
  it("reads an inline quantity clause", () => {
    const d = parseReceiptText("EAU MINERALE 6 x 0,45 2,70\nTOTAL 2,70");
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0].label).toBe("EAU MINERALE");
    expect(d.lines[0].amount).toBe(6);
    expect(d.lines[0].price).toBe(270);
  });
  it("tolerates a dotted price with a tax letter and no shop", () => {
    const d = parseReceiptText("COMTE AOP 4.20 B\nTOTAL 4.20");
    expect(d.shopId).toBe("");
    expect(d.lines[0].price).toBe(420);
    expect(d.total).toBe(420);
  });
});

describe("helpers", () => {
  it("findDate reads dd/mm/yy and dd.mm.yyyy, rejects nonsense", () => {
    expect(findDate("le 04.09.26")).toBe("2026-09-04");
    expect(findDate("31/12/2025")).toBe("2025-12-31");
    expect(findDate("99/99/99 nothing")).toBe("");
  });
  it("findShop is accent- and case-blind", () => {
    expect(findShop("BIOCOOP MONTREUIL", [{ id: "b", title: "Biocoop" }])).toBe("b");
    expect(findShop("nothing here", [{ id: "b", title: "Biocoop" }])).toBe("");
  });
});
