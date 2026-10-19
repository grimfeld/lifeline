// @vitest-environment jsdom
// The Prices manifest carries its screens and dialogs, whose UI imports need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, putDocument } from "@lifeline/core";
import { pricesApp } from "../index";
import { pricesCommands } from "../commands";
import { LINE, PRODUCT, type Line } from "../domain/types";
import { addPrice, addProduct, addShop, allProducts, allShops, mergeProduct, updateProduct } from "./repo";

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

  it("keeps its dimension: a change of dimension is refused here", async () => {
    const eggs = await addProduct({ title: "Eggs", dimension: "count", unit: "pc" });
    await expect(updateProduct(await product(eggs), { title: "Eggs", dimension: "mass", unit: "kg" })).rejects.toThrow(/dimension/i);
    expect((await product(eggs)).dimension).toBe("count");
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
