import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, documentsWhere, getDocument, initApps, removeDocument, type DocumentTypeDef } from "@lifeline/core";
import { LINE, PRODUCT, RECEIPT, SHOP, type Line, type Receipt } from "../domain/types";
import { addPrice, addProduct, addShop, allProducts, allShops, cascadeReceiptDelete, mergeProduct, refuseDeletingUsedProduct, refuseDeletingUsedShop, saveReceipt, type ReceiptInput } from "./repo";

// The Prices types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string, indexes: string[] = [], onDelete?: DocumentTypeDef["onDelete"]) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes, onDelete, builtIn: true }) as unknown as DocumentTypeDef;
initApps([{ id: "prices", title: "Prices", types: [bare(PRODUCT, [], refuseDeletingUsedProduct), bare(SHOP, [], refuseDeletingUsedShop), bare(RECEIPT, ["shopId", "date"], cascadeReceiptDelete), bare(LINE, ["receiptId", "productId"])], screens: [], cards: [], commands: [] }]);

const receipt = async (id: string) => (await getDocument<Receipt>(id))!;

let lidl: string;
let milk: string;
beforeEach(async () => {
  await documentsTable().clear();
  lidl = await addShop({ title: "Lidl" });
  milk = await addProduct({ title: "Milk", dimension: "volume", unit: "L" });
});

const price = async (over: { bought?: boolean } = {}) => addPrice({ productId: milk, shopId: lidl, amount: 1, price: 109, promo: false, date: "2026-10-01", ...over }, await allShops(), await allProducts());
const bought = (over: Partial<ReceiptInput> = {}): ReceiptInput => ({ shopId: lidl, date: "2026-10-01", total: 540, lines: [{ productId: milk, label: "LAIT", amount: 1, price: 540, promo: false }], ...over });

describe("Add price", () => {
  it("makes a Sighting — noticed, not bought — by default", async () => {
    expect((await receipt(await price())).noticed).toBe(true);
  });

  it("makes a bought Receipt when Bought it is ticked", async () => {
    expect((await receipt(await price({ bought: true }))).noticed).toBe(false);
  });

  it("two shelf prices on one day at one Shop are both kept", async () => {
    const a = await price();
    const b = await price();
    expect(a).not.toBe(b);
  });
});

describe("the duplicate-Receipt rule", () => {
  it("still refuses a bought Receipt added twice", async () => {
    await saveReceipt(bought(), await allShops(), await allProducts());
    await expect(saveReceipt(bought(), await allShops(), await allProducts())).rejects.toThrow(/Already added/);
  });

  it("never refuses a Sighting, even one with the same printed total", async () => {
    await saveReceipt(bought(), await allShops(), await allProducts());
    const id = await saveReceipt(bought({ noticed: true }), await allShops(), await allProducts());
    expect((await receipt(id)).noticed).toBe(true);
  });

  it("never counts a Sighting as the twin of a bought Receipt", async () => {
    await saveReceipt(bought({ noticed: true }), await allShops(), await allProducts());
    await expect(saveReceipt(bought(), await allShops(), await allProducts())).resolves.toBeTruthy();
  });
});

describe("the noticed mark", () => {
  it("is unticked on a Receipt that was a real purchase, its Lines kept", async () => {
    const id = await price();
    const r = await receipt(id);
    const lines = (await documentsTable().toArray()).filter((d) => d.type === LINE) as Line[];
    await saveReceipt({ shopId: r.shopId, date: r.date, total: 0, noticed: false, lines: lines.map((l) => ({ id: l.id, productId: l.productId, label: l.label, amount: l.amount, price: l.price, promo: l.promo })) }, await allShops(), await allProducts(), { receipt: r, lines });
    expect((await receipt(id)).noticed).toBe(false);
    expect((await documentsTable().toArray()).filter((d) => d.type === LINE && !d.deleted)).toHaveLength(1);
  });
});

describe("deleting, from any path (removeDocument)", () => {
  const linesOf = (receiptId: string) => documentsWhere<Line>(LINE, "receiptId", receiptId);

  it("refuses deleting a Product that Lines reference, and leaves it", async () => {
    await saveReceipt(bought(), await allShops(), await allProducts());
    await expect(removeDocument(milk)).rejects.toThrow(/merge it into another/);
    expect(await getDocument(milk)).toBeDefined();
  });

  it("deletes a Product no Line references", async () => {
    await removeDocument(milk);
    expect(await getDocument(milk)).toBeUndefined();
  });

  it("refuses deleting a Shop that Receipts reference, and leaves it", async () => {
    await saveReceipt(bought(), await allShops(), await allProducts());
    await expect(removeDocument(lidl)).rejects.toThrow(/it stays/);
    expect(await getDocument(lidl)).toBeDefined();
  });

  it("deletes a Shop no Receipt references", async () => {
    await removeDocument(lidl);
    expect(await getDocument(lidl)).toBeUndefined();
  });

  it("deleting a Receipt deletes its Lines and no one else's", async () => {
    const a = await saveReceipt(bought(), await allShops(), await allProducts());
    const b = await saveReceipt(bought({ date: "2026-10-02" }), await allShops(), await allProducts());
    expect(await linesOf(a)).toHaveLength(1);
    await removeDocument(a);
    expect(await getDocument(a)).toBeUndefined();
    expect(await linesOf(a)).toHaveLength(0);
    expect(await linesOf(b)).toHaveLength(1);
  });

  it("a Product can be deleted once its Receipt is gone", async () => {
    const r = await saveReceipt(bought(), await allShops(), await allProducts());
    await removeDocument(r);
    await removeDocument(milk);
    expect(await getDocument(milk)).toBeUndefined();
  });

  it("merging a Product repoints its Lines, then the removal passes", async () => {
    const oil = await addProduct({ title: "Oil", dimension: "volume", unit: "L" });
    const r = await saveReceipt(bought(), await allShops(), await allProducts());
    const products = await allProducts();
    await mergeProduct(products.find((p) => p.id === milk)!, products.find((p) => p.id === oil)!);
    expect(await getDocument(milk)).toBeUndefined();
    expect((await linesOf(r)).map((l) => l.productId)).toEqual([oil]);
  });
});
