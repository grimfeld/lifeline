import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { lastSecondAmount, observe, unitPrice } from "../domain/derive";
import { amountIn, amountUnit, formatUnitPrice, fromAmount, measureOf, secondaryMeasure } from "../domain/measure";
import { parseAmount } from "../domain/money";
import { addPrice, useLines, useProducts, useReceipts, useShops } from "../data/repo";
import { ProductSelect, ShopSelect } from "./pickers";
import { ProductDialog } from "./ProductDialog";
import { ShopDialog } from "./ShopDialog";

/**
 * The capture form for a price seen on a shelf (ADR 0082): product, shop,
 * amount, price — a one-Line Receipt with no printed total, a Sighting
 * unless "Bought it" is ticked (ADR 0084). Day defaults to today. "Save &
 * add another" keeps the shop, the day and "Bought it". A Product with a
 * secondary Measure takes a second amount too, prefilled from its last
 * Line at the Shop; the preview reads the compared-by unit.
 */
export function AddPriceDialog({ open, onOpenChange, productId: presetProduct }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string }) {
  const products = useProducts();
  const shops = useShops();
  const [productId, setProductId] = useState("");
  const [shopId, setShopId] = useState("");
  const [amount, setAmount] = useState("1");
  const [second, setSecond] = useState("");
  const [price, setPrice] = useState("");
  const [promo, setPromo] = useState(false);
  const [bought, setBought] = useState(false);
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
    setBought(false);
    setDate(todayStr());
    // shops arrive async; defaulting once they do is wanted
  }, [open, presetProduct, shops]);

  const product = products.find((p) => p.id === productId);
  const secondM = product ? secondaryMeasure(product) : undefined;
  const lines = useLines();
  const receipts = useReceipts();
  const obs = useMemo(() => observe(lines, receipts), [lines, receipts]);
  // The second amount starts from this Product's last pack at this Shop; typed only when it changed.
  const prefill = product && secondM ? lastSecondAmount(obs, product.id, shopId) : 0;
  useEffect(() => {
    setSecond(prefill > 0 && secondM ? String(amountIn(prefill, secondM)) : "");
    // Re-prefilled when the Product or Shop changes, not on every typed character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, shopId, prefill]);
  const cents = parseAmount(price);
  const typed = Number(amount.replace(",", "."));
  // Typed in the Product's reading unit (420 on a gram Product), kept in its base unit (0.42 kg).
  const amt = product ? fromAmount(typed, product) : typed;
  const typedSecond = Number(second.replace(",", "."));
  const secondAmt = secondM && second.trim() && typedSecond > 0 ? fromAmount(typedSecond, secondM) : 0;
  const per = product && product.compareBy === "secondary" && secondM ? secondAmt : amt;
  const preview = product && cents !== null && cents >= 0 && per > 0 ? formatUnitPrice(unitPrice({ price: cents, amount: per }), measureOf(product)) : null;

  async function save(another: boolean) {
    if (cents === null || cents < 0) return void toast.error("Type the price paid");
    if (!(amt > 0)) return void toast.error("Amount must be above zero");
    try {
      if (secondM && second.trim() && !(typedSecond >= 0)) return void toast.error("The second amount is a number");
      await addPrice({ productId, shopId, amount: amt, secondAmount: secondM ? secondAmt : undefined, price: cents, promo, bought, date }, shops, products);
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
              <Label htmlFor="ap-amount">Amount{product ? ` (${amountUnit(product)})` : ""}</Label>
              <Input id="ap-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ap-price">Price paid</Label>
              <Input id="ap-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="1,29" autoFocus onKeyDown={(e) => e.key === "Enter" && void save(false)} />
            </div>
          </div>
          {secondM && (
            <div className="grid gap-2">
              <Label htmlFor="ap-second">Also measured ({amountUnit(secondM)})</Label>
              <Input id="ap-second" value={second} onChange={(e) => setSecond(e.target.value)} inputMode="decimal" placeholder="not measured" />
            </div>
          )}
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ap-date">Day</Label>
              <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={promo} onCheckedChange={(v) => setPromo(v === true)} /> Promo
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={bought} onCheckedChange={(v) => setBought(v === true)} /> Bought it
              </label>
            </div>
          </div>
          {!bought && <p className="text-muted-foreground text-xs">Noticed, not bought: it counts for what things cost, never as spending.</p>}
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
