// @vitest-environment jsdom
// The Prices manifest carries its screens and dialogs, whose UI imports need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps } from "@lifeline/core";
import { pricesApp } from "../index";
import { pricesCommands } from "../commands";
import { addPrice, addProduct, addShop, allLines, allProducts, allReceipts, allShops, saveReceipt, updateProduct } from "./repo";

initApps([pricesApp]);

const product = async (id: string) => (await allProducts()).find((p) => p.id === id)!;
const seconds = async () => (await allLines()).map((l) => l.secondAmount).sort();
const run = (id: string, args: Record<string, unknown>) => pricesCommands.find((c) => c.id === id)!.invoke!(args);

beforeEach(async () => {
  await documentsTable().clear();
});

const croissants = () => addProduct({ title: "Croissants", dimension: "count", unit: "pc", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" });

describe("a secondary Measure (ADR 0084)", () => {
  it("is declared by a counted Product with its reading unit and compare-by", async () => {
    const id = await croissants();
    expect(await product(id)).toMatchObject({ dimension: "count", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" });
    const plain = await addProduct({ title: "Eggs", dimension: "count" });
    expect(await product(plain)).toMatchObject({ secondaryDimension: "", compareBy: "primary" });
  });

  it("is refused off a count, and in a unit of another dimension", async () => {
    await expect(addProduct({ title: "Flour", dimension: "mass", secondaryDimension: "volume" })).rejects.toThrow(/count/);
    await expect(addProduct({ title: "Buns", dimension: "count", secondaryDimension: "mass", secondaryUnit: "ml" })).rejects.toThrow(/unit/);
  });

  it("a second amount is kept on the Line, and prefilled from the Product's last Line at the same Shop", async () => {
    const lidl = await addShop({ title: "Lidl" });
    const aldi = await addShop({ title: "Aldi" });
    const id = await croissants();
    await addPrice({ productId: id, shopId: lidl, amount: 4, secondAmount: 0.24, price: 240, promo: false, date: "2026-10-01" }, await allShops(), await allProducts());
    await addPrice({ productId: id, shopId: lidl, amount: 4, secondAmount: 0.25, price: 250, promo: false, date: "2026-10-05" }, await allShops(), await allProducts());
    // Not given: Lidl's last pack weighed 250 g; Aldi has none to go on.
    await addPrice({ productId: id, shopId: lidl, amount: 4, price: 260, promo: false, date: "2026-10-09" }, await allShops(), await allProducts());
    await addPrice({ productId: id, shopId: aldi, amount: 6, price: 330, promo: false, date: "2026-10-09" }, await allShops(), await allProducts());
    // Given as 0: none recorded, not prefilled.
    await addPrice({ productId: id, shopId: lidl, amount: 4, secondAmount: 0, price: 270, promo: false, date: "2026-10-10" }, await allShops(), await allProducts());
    const byPrice = (await allLines()).sort((a, b) => a.price - b.price).map((l) => l.secondAmount);
    expect(byPrice).toEqual([0.24, 0.25, 0.25, 0, 0]);
  });

  it("a Product without a secondary Measure keeps no second amount", async () => {
    const lidl = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count" });
    await addPrice({ productId: eggs, shopId: lidl, amount: 12, secondAmount: 0.7, price: 360, promo: false }, await allShops(), await allProducts());
    expect(await seconds()).toEqual([0]);
  });

  it("re-saving a Receipt keeps its Lines' second amounts", async () => {
    const lidl = await addShop({ title: "Lidl" });
    const id = await croissants();
    const rid = await saveReceipt({ shopId: lidl, date: "2026-10-01", total: 0, lines: [{ productId: id, label: "CROISSANTS", amount: 4, secondAmount: 0.24, price: 240, promo: false }] }, await allShops(), await allProducts());
    const receipt = (await allReceipts()).find((r) => r.id === rid)!;
    const lines = await allLines();
    await saveReceipt({ shopId: lidl, date: "2026-10-01", total: 0, lines: lines.map(({ id: lid, productId, label, amount, price, promo }) => ({ id: lid, productId, label, amount, price, promo })) }, await allShops(), await allProducts(), { receipt, lines });
    expect(await seconds()).toEqual([0.24]);
  });

  describe("second amounts are cleared", () => {
    async function seeded() {
      const lidl = await addShop({ title: "Lidl" });
      const id = await croissants();
      await addPrice({ productId: id, shopId: lidl, amount: 4, secondAmount: 0.24, price: 240, promo: false }, await allShops(), await allProducts());
      return id;
    }

    it("when the secondary Measure is removed", async () => {
      const id = await seeded();
      await updateProduct(await product(id), { title: "Croissants", secondaryDimension: "" });
      expect(await product(id)).toMatchObject({ secondaryDimension: "", compareBy: "primary" });
      expect(await seconds()).toEqual([0]);
    });

    it("when it changes dimension", async () => {
      const id = await seeded();
      await updateProduct(await product(id), { title: "Croissants", secondaryDimension: "volume", secondaryUnit: "ml" });
      expect(await seconds()).toEqual([0]);
    });

    it("when the primary changes dimension", async () => {
      const id = await seeded();
      await updateProduct(await product(id), { title: "Croissants", dimension: "mass", unit: "kg" });
      expect(await product(id)).toMatchObject({ dimension: "mass", secondaryDimension: "", compareBy: "primary" });
      expect((await allLines()).map((l) => [l.secondAmount, l.needsAmount])).toEqual([[0, true]]);
    });

    it("but not when only its reading unit or compare-by changes", async () => {
      const id = await seeded();
      await updateProduct(await product(id), { title: "Croissants", secondaryUnit: "kg", compareBy: "primary" });
      expect(await product(id)).toMatchObject({ secondaryUnit: "kg", compareBy: "primary" });
      expect(await seconds()).toEqual([0.24]);
    });
  });
});

describe("second amounts over MCP (prices_receipt, prices_add)", () => {
  it("are in the secondary reading unit unless a unit is given, stored in its base unit", async () => {
    const shop = await addShop({ title: "Lidl" });
    const id = await croissants();
    await run("prices.add", { product: id, shop, price: 2.4, amount: 4, second_amount: 240 });
    await run("prices.receipt", { shop, date: "2026-10-02", lines: [{ label: "CROISSANTS", price: 2.5, amount: 4, second_amount: 0.26, second_unit: "kg", product: id }] });
    expect(await seconds()).toEqual([0.24, 0.26]);
  });

  it("are refused for a Product with no secondary Measure, or in a unit of another dimension", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count" });
    const id = await croissants();
    await expect(run("prices.add", { product: eggs, shop, price: 3, amount: 12, second_amount: 700 })).rejects.toThrow(/secondary/);
    await expect(run("prices.receipt", { shop, lines: [{ label: "CROISSANTS", price: 2.5, amount: 4, second_amount: 250, second_unit: "ml", product: id }] })).rejects.toThrow(/row 1/);
  });

  it("New product… takes a secondary Measure and compare-by", async () => {
    const { id } = (await run("prices.product-add", { name: "Buns", dimension: "count", secondary_dimension: "mass", secondary_unit: "g", compare_by: "secondary" })) as { id: string };
    expect(await product(id)).toMatchObject({ secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" });
  });
});
