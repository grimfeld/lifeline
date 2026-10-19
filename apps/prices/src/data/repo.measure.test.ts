// @vitest-environment jsdom
// The Prices manifest carries its screens and dialogs, whose UI imports need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, putDocument } from "@lifeline/core";
import { pricesApp } from "../index";
import { pricesCommands } from "../commands";
import { LINE, PRODUCT, type Line } from "../domain/types";
import { addPrice, addProduct, addShop, allLines, allProducts, allReceipts, allShops, mergeProduct, saveReceipt, setLineAmount, updateProduct } from "./repo";
import { linesToRetype } from "../domain/derive";

initApps([pricesApp]);

const product = async (id: string) => (await allProducts()).find((p) => p.id === id)!;

beforeEach(async () => {
  await documentsTable().clear();
});

describe("a Product's Measure", () => {
  it("is made with a dimension, a reading unit and, for a count, a name of its own", async () => {
    const spice = await addProduct({ title: "Cumin", dimension: "mass", unit: "100g" });
    const soap = await addProduct({ title: "Detergent", dimension: "count", unit: "pc", countName: "wash" });
    expect(await product(spice)).toMatchObject({ dimension: "mass", unit: "100g", countName: "" });
    expect(await product(soap)).toMatchObject({ dimension: "count", unit: "pc", countName: "wash" });
  });

  it("refuses a unit from another dimension", async () => {
    await expect(addProduct({ title: "Milk", dimension: "volume", unit: "kg" })).rejects.toThrow(/unit/i);
  });

  it("changing the reading unit or the count name rewrites no Line", async () => {
    const shop = await addShop({ title: "Lidl" });
    const coffee = await addProduct({ title: "Coffee", dimension: "mass", unit: "kg" });
    await addPrice({ productId: coffee, shopId: shop, amount: 0.5, price: 749, promo: false }, await allShops(), await allProducts());
    const before = await documentsOf<Line>(LINE);

    await updateProduct(await product(coffee), { title: "Coffee", unit: "g" });
    await updateProduct(await product(coffee), { title: "Coffee", unit: "100g" });

    expect(await documentsOf<Line>(LINE)).toEqual(before);
    expect((await product(coffee)).unit).toBe("100g");
  });

  it("renaming a count rewrites no Line either", async () => {
    const shop = await addShop({ title: "Lidl" });
    const paper = await addProduct({ title: "Toilet paper", dimension: "count", unit: "pc" });
    await addPrice({ productId: paper, shopId: shop, amount: 9, price: 399, promo: false }, await allShops(), await allProducts());
    const before = await documentsOf<Line>(LINE);
    await updateProduct(await product(paper), { title: "Toilet paper", countName: "roll" });
    expect(await documentsOf<Line>(LINE)).toEqual(before);
    expect((await product(paper)).countName).toBe("roll");
  });

  it("changes dimension at once, every Line of the Product then needing an amount", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    const milk = await addProduct({ title: "Milk", dimension: "volume", unit: "L" });
    await addPrice({ productId: eggs, shopId: shop, amount: 12, price: 360, promo: false }, await allShops(), await allProducts());
    await addPrice({ productId: eggs, shopId: shop, amount: 6, price: 199, promo: true }, await allShops(), await allProducts());
    await addPrice({ productId: milk, shopId: shop, amount: 1, price: 109, promo: false }, await allShops(), await allProducts());

    await updateProduct(await product(eggs), { title: "Eggs", dimension: "mass", unit: "kg" });

    expect(await product(eggs)).toMatchObject({ dimension: "mass", unit: "kg", countName: "" });
    const lines = await allLines();
    expect(lines.filter((l) => l.productId === eggs).map((l) => [l.amount, l.needsAmount]).sort()).toEqual([
      [12, true],
      [6, true],
    ]);
    expect(lines.find((l) => l.productId === milk)?.needsAmount).toBe(false);
  });

  it("a change within the dimension marks nothing", async () => {
    const shop = await addShop({ title: "Lidl" });
    const coffee = await addProduct({ title: "Coffee", dimension: "mass", unit: "kg" });
    await addPrice({ productId: coffee, shopId: shop, amount: 0.5, price: 749, promo: false }, await allShops(), await allProducts());
    await updateProduct(await product(coffee), { title: "Coffee", dimension: "mass", unit: "g" });
    expect((await allLines()).map((l) => l.needsAmount)).toEqual([false]);
  });

  it("tells beforehand how many Lines a change would send to the inbox", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    await addPrice({ productId: eggs, shopId: shop, amount: 12, price: 360, promo: false }, await allShops(), await allProducts());
    await addPrice({ productId: eggs, shopId: shop, amount: 6, price: 199, promo: false }, await allShops(), await allProducts());
    const lines = await allLines();
    expect(linesToRetype(lines, await product(eggs), "mass")).toHaveLength(2);
    expect(linesToRetype(lines, await product(eggs), "count")).toHaveLength(0);
  });

  it("typing a Line's amount clears it from the inbox", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    await addPrice({ productId: eggs, shopId: shop, amount: 12, price: 360, promo: false }, await allShops(), await allProducts());
    await updateProduct(await product(eggs), { title: "Eggs", dimension: "mass", unit: "g" });
    const [waiting] = await allLines();

    await setLineAmount(waiting, 720, await product(eggs));

    const [l] = await allLines();
    expect([l.amount, l.needsAmount]).toEqual([0.72, false]);
    await expect(setLineAmount(l, 0, await product(eggs))).rejects.toThrow(/above zero/);
  });

  it("re-saving a Receipt keeps its Lines' mark unless the amount was retyped", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    const rid = await saveReceipt({ shopId: shop, date: "2026-10-01", total: 0, lines: [{ productId: eggs, label: "OEUFS", amount: 12, price: 360, promo: false }, { productId: eggs, label: "OEUFS BIO", amount: 6, price: 250, promo: false }] }, await allShops(), await allProducts());
    await updateProduct(await product(eggs), { title: "Eggs", dimension: "mass", unit: "kg" });
    const [receipt] = (await allReceipts()).filter((r) => r.id === rid);
    const [a, b] = (await allLines()).sort((x, y) => x.label.localeCompare(y.label));

    await saveReceipt({ shopId: shop, date: "2026-10-01", total: 0, lines: [{ ...a, retyped: true, amount: 0.72 }, { ...b }] }, await allShops(), await allProducts(), { receipt, lines: [a, b] });

    expect((await allLines()).sort((x, y) => x.label.localeCompare(y.label)).map((l) => [l.label, l.amount, l.needsAmount])).toEqual([
      ["OEUFS", 0.72, false],
      ["OEUFS BIO", 6, true],
    ]);
  });

  it("a Product stored with an old measure reads in the new shape", async () => {
    await putDocument({ type: PRODUCT, title: "Old milk", measure: "l", labels: [], folder: "", tags: [] });
    await putDocument({ type: PRODUCT, title: "Old eggs", measure: "piece", labels: [], folder: "", tags: [] });
    const all = await allProducts();
    expect(all.find((p) => p.title === "Old milk")).toMatchObject({ dimension: "volume", unit: "L", countName: "" });
    expect(all.find((p) => p.title === "Old eggs")).toMatchObject({ dimension: "count", unit: "pc", countName: "" });
  });

  it("merges across reading units of one dimension, Lines kept as they were", async () => {
    const shop = await addShop({ title: "Lidl" });
    const a = await addProduct({ title: "Pepper", dimension: "mass", unit: "100g" });
    const b = await addProduct({ title: "Black pepper", dimension: "mass", unit: "kg" });
    await addPrice({ productId: a, shopId: shop, amount: 0.05, price: 189, promo: false }, await allShops(), await allProducts());
    await mergeProduct(await product(a), await product(b));
    const [l] = await documentsOf<Line>(LINE);
    expect([l.productId, l.amount]).toEqual([b, 0.05]);
  });

  it("merges within one dimension with every Line's amount and mark intact, labels carried over", async () => {
    const lidl = await addShop({ title: "Lidl" });
    const aldi = await addShop({ title: "Aldi" });
    const a = await addProduct({ title: "Rice", dimension: "mass", unit: "g" });
    const b = await addProduct({ title: "Basmati rice", dimension: "mass", unit: "kg" });
    await saveReceipt({ shopId: lidl, date: "2026-10-01", total: 0, lines: [{ productId: a, label: "RIZ 500G", amount: 0.5, price: 139, promo: false }] }, await allShops(), await allProducts());
    await saveReceipt({ shopId: aldi, date: "2026-10-02", total: 0, lines: [{ productId: b, label: "BASMATI", amount: 1, price: 249, promo: false }] }, await allShops(), await allProducts());

    await mergeProduct(await product(a), await product(b));

    expect((await allLines()).map((l) => [l.label, l.productId, l.amount, l.needsAmount]).sort()).toEqual([
      ["BASMATI", b, 1, false],
      ["RIZ 500G", b, 0.5, false],
    ]);
    expect((await product(b)).labels).toEqual(expect.arrayContaining([{ shopId: lidl, label: "RIZ 500G" }, { shopId: aldi, label: "BASMATI" }]));
    expect((await allProducts()).map((p) => p.id)).toEqual([b]);
  });

  it("merges across dimensions, the source's Lines then needing an amount in the target's Measure", async () => {
    const shop = await addShop({ title: "Lidl" });
    const pieces = await addProduct({ title: "Croissants (pc)", dimension: "count", unit: "pc" });
    const weighed = await addProduct({ title: "Croissants", dimension: "mass", unit: "kg" });
    await saveReceipt({ shopId: shop, date: "2026-10-01", total: 0, lines: [{ productId: pieces, label: "CROISSANT X4", amount: 4, price: 199, promo: false }, { productId: pieces, label: "CROISSANT X6", amount: 6, price: 279, promo: true }] }, await allShops(), await allProducts());
    await addPrice({ productId: weighed, shopId: shop, amount: 0.24, price: 219, promo: false }, await allShops(), await allProducts());

    await mergeProduct(await product(pieces), await product(weighed));

    expect((await allLines()).map((l) => [l.label, l.productId, l.amount, l.needsAmount]).sort()).toEqual([
      ["CROISSANT X4", weighed, 4, true],
      ["CROISSANT X6", weighed, 6, true],
      ["Croissants", weighed, 0.24, false],
    ]);
    expect((await product(weighed)).labels).toEqual(expect.arrayContaining([{ shopId: shop, label: "CROISSANT X4" }, { shopId: shop, label: "CROISSANT X6" }]));
    expect((await product(weighed)).dimension).toBe("mass");
  });
});

describe("amounts over MCP (prices_add, prices_receipt)", () => {
  const run = (id: string, args: Record<string, unknown>) => pricesCommands.find((c) => c.id === id)!.invoke!(args);

  it("are in the Product's reading unit unless a unit is given, and stored in the base unit", async () => {
    const shop = await addShop({ title: "Lidl" });
    const cumin = await addProduct({ title: "Cumin", dimension: "mass", unit: "g" });
    await run("prices.add", { product: cumin, shop, price: 1.89, amount: 30 });
    await run("prices.add", { product: cumin, shop, price: 5.5, amount: 0.1, unit: "kg" });
    await run("prices.receipt", { shop, lines: [{ label: "CUMIN", price: 2, amount: 50, product: cumin }, { label: "CUMIN BIG", price: 9, amount: 0.25, unit: "kg", product: cumin }] });
    expect((await documentsOf<Line>(LINE)).map((l) => l.amount).sort()).toEqual([0.03, 0.05, 0.1, 0.25]);
  });

  it("refuse a unit of another dimension", async () => {
    const shop = await addShop({ title: "Lidl" });
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    await expect(run("prices.add", { product: eggs, shop, price: 3, amount: 600, unit: "g" })).rejects.toThrow(/mass/);
    await expect(run("prices.receipt", { shop, lines: [{ label: "EGGS", price: 3, amount: 600, unit: "g", product: eggs }] })).rejects.toThrow(/row 1/);
  });

  it("New product… takes a dimension, a unit and a count name", async () => {
    const { id } = (await run("prices.product-add", { name: "Detergent", dimension: "count", count_name: "wash" })) as { id: string };
    expect(await product(id)).toMatchObject({ dimension: "count", unit: "pc", countName: "wash" });
    await expect(run("prices.product-add", { name: "Milk", dimension: "volume", unit: "g" })).rejects.toThrow(/not a unit/);
  });
});
