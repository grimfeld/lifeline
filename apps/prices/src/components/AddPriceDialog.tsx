import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { observe, secondPrefill, unitPrice } from "../domain/derive";
import { amountUnit, defaultAmount, formatUnitPrice, fromAmount, measureOf, secondaryMeasure } from "../domain/measure";
import { parseAmount, parseNumber } from "../domain/money";
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
 * Line at the Shop — again when the Shop changes, unless one was typed; the
 * preview reads the compared-by unit. The amount defaults to one for a count
 * only; anything weighed, poured or measured needs it typed.
 */
export function AddPriceDialog({ open, onOpenChange, productId: presetProduct }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string }) {
  const products = useProducts();
  const shops = useShops();
  const [productId, setProductId] = useState("");
  const [shopId, setShopId] = useState("");
  const [amount, setAmount] = useState("");
  const [second, setSecond] = useState("");
  /** The second amount was typed here: a new Shop no longer prefills it. */
  const [secondTyped, setSecondTyped] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; price?: string; second?: string }>({});
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
    setAmount("");
    setSecondTyped(false);
    setErrors({});
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
  const prefill = secondPrefill(obs, product, shopId);
  useEffect(() => {
    if (!secondTyped) setSecond(prefill === undefined ? "" : String(prefill));
  }, [productId, shopId, prefill, secondTyped]);
  const pickProduct = (id: string) => {
    setProductId(id);
    setSecondTyped(false);
    setErrors({});
  };
  const cents = parseAmount(price);
  // Typed in the Product's reading unit (420 on a gram Product), kept in its base unit (0.42 kg); blank is one, for a count only.
  const typed = parseNumber(amount) ?? defaultAmount(product);
  const amt = typed === undefined ? 0 : product ? fromAmount(typed, product) : typed;
  const typedSecond = parseNumber(second);
  const secondAmt = secondM && typedSecond !== null && typedSecond > 0 ? fromAmount(typedSecond, secondM) : 0;
  const per = product && product.compareBy === "secondary" && secondM ? secondAmt : amt;
  const preview = product && cents !== null && cents >= 0 && per > 0 ? formatUnitPrice(unitPrice({ price: cents, amount: per }), measureOf(product)) : null;

  const clearError = (field: keyof typeof errors) => setErrors((x) => ({ ...x, [field]: undefined }));

  /** What is wrong with each field, shown under it; empty when the form can be saved. */
  function check(): typeof errors {
    const out: typeof errors = {};
    if (cents === null || cents < 0) out.price = "Type the price paid";
    if (typed === undefined) out.amount = `Type the amount${product ? `, in ${amountUnit(product)}` : ""}`;
    else if (!(typed > 0)) out.amount = "The amount is above zero";
    if (secondM && second.trim() && !(typedSecond !== null && typedSecond >= 0)) out.second = "A number, or empty when not measured";
    return out;
  }

  async function save(another: boolean) {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await addPrice({ productId, shopId, amount: amt, secondAmount: secondM ? secondAmt : undefined, price: cents!, promo, bought, date }, shops, products);
      toast.success(preview ? `${product?.title}: ${preview}` : "Price added");
    } catch (e) {
      return void toast.error(`The price was not added: ${(e as Error).message}`);
    }
    if (another) {
      pickProduct("");
      setAmount("");
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
            <ProductSelect value={productId} onChange={pickProduct} products={products} onNew={() => setNewProduct(true)} />
          </div>
          <div className="grid gap-2">
            <Label>Shop</Label>
            <ShopSelect value={shopId} onChange={setShopId} shops={shops} onNew={() => setNewShop(true)} />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label={product ? `Amount (${amountUnit(product)})` : "Amount"} error={errors.amount}>
              <Input value={amount} onChange={(e) => {
                  setAmount(e.target.value);
                  clearError("amount");
                }} inputMode="decimal" placeholder={defaultAmount(product) ? "1" : product ? amountUnit(product) : undefined} />
            </Field>
            <Field label="Price paid" error={errors.price}>
              <Input value={price} onChange={(e) => {
                  setPrice(e.target.value);
                  clearError("price");
                }} inputMode="decimal" placeholder="1,29" autoFocus onKeyDown={(e) => e.key === "Enter" && void save(false)} />
            </Field>
          </div>
          {secondM && (
            <Field label={`Also measured (${amountUnit(secondM)})`} error={errors.second}>
              <Input value={second} onChange={(e) => {
                  setSecond(e.target.value);
                  setSecondTyped(true);
                  clearError("second");
                }} inputMode="decimal" placeholder="not measured" />
            </Field>
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
        <ProductDialog open={newProduct} onOpenChange={setNewProduct} onCreated={pickProduct} />
        <ShopDialog open={newShop} onOpenChange={setNewShop} onCreated={setShopId} />
      </DialogContent>
    </Dialog>
  );
}
