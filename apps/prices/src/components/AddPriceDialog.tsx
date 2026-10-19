import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { MEASURE_UNIT } from "../domain/types";
import { formatUnitPrice, unitPrice } from "../domain/derive";
import { parseAmount } from "../domain/money";
import { addPrice, useProducts, useShops } from "../data/repo";
import { ProductSelect, ShopSelect } from "./pickers";
import { ProductDialog } from "./ProductDialog";
import { ShopDialog } from "./ShopDialog";

/**
 * The capture form for a price seen on a shelf (ADR 0082): product, shop,
 * amount, price — a one-Line Receipt with no printed total. Day defaults to
 * today. "Save & add another" keeps the shop and day.
 */
export function AddPriceDialog({ open, onOpenChange, productId: presetProduct }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string }) {
  const products = useProducts();
  const shops = useShops();
  const [productId, setProductId] = useState("");
  const [shopId, setShopId] = useState("");
  const [amount, setAmount] = useState("1");
  const [price, setPrice] = useState("");
  const [promo, setPromo] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [newProduct, setNewProduct] = useState(false);
  const [newShop, setNewShop] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(presetProduct ?? "");
    setShopId((s) => s || shops[0]?.id || "");
    setAmount("1");
    setPrice("");
    setPromo(false);
    setDate(todayStr());
    // shops arrive async; defaulting once they do is wanted
  }, [open, presetProduct, shops]);

  const product = products.find((p) => p.id === productId);
  const cents = parseAmount(price);
  const amt = Number(amount.replace(",", "."));
  const preview = product && cents !== null && cents >= 0 && amt > 0 ? formatUnitPrice(unitPrice({ price: cents, amount: amt }), product.measure) : null;

  async function save(another: boolean) {
    if (cents === null || cents < 0) return void toast.error("Type the price paid");
    if (!(amt > 0)) return void toast.error("Amount must be above zero");
    try {
      await addPrice({ productId, shopId, amount: amt, price: cents, promo, date }, shops, products);
      toast.success(preview ? `${product?.title}: ${preview}` : "Price added");
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    if (another) {
      setProductId("");
      setAmount("1");
      setPrice("");
      setPromo(false);
    } else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add price</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Product</Label>
            <ProductSelect value={productId} onChange={setProductId} products={products} onNew={() => setNewProduct(true)} />
          </div>
          <div className="grid gap-2">
            <Label>Shop</Label>
            <ShopSelect value={shopId} onChange={setShopId} shops={shops} onNew={() => setNewShop(true)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ap-amount">Amount{product ? ` (${MEASURE_UNIT[product.measure]})` : ""}</Label>
              <Input id="ap-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-price">Price paid</Label>
              <Input id="ap-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="1,29" autoFocus onKeyDown={(e) => e.key === "Enter" && void save(false)} />
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ap-date">Day</Label>
              <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={promo} onCheckedChange={(v) => setPromo(v === true)} /> Promo
            </label>
          </div>
          {preview && <p className="text-muted-foreground text-xs tabular-nums">{preview}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => void save(true)} disabled={!productId || !shopId}>
            Save & add another
          </Button>
          <Button onClick={() => void save(false)} disabled={!productId || !shopId}>
            Add
          </Button>
        </DialogFooter>
        <ProductDialog open={newProduct} onOpenChange={setNewProduct} onCreated={setProductId} />
        <ShopDialog open={newShop} onOpenChange={setNewShop} onCreated={setShopId} />
      </DialogContent>
    </Dialog>
  );
}
