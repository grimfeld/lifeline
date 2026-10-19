import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, cn, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { ImagePlus, Plus, TriangleAlert, X } from "lucide-react";
import type { Line, Receipt } from "../domain/types";
import { amountIn, amountUnit, fromAmount } from "../domain/measure";
import { linesOf, sumOfLines } from "../domain/derive";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { deleteReceipt, saveReceipt, useLines, useProducts, useShops, type LineInput } from "../data/repo";
import { ProductSelect, ShopSelect } from "./pickers";
import { ProductDialog } from "./ProductDialog";
import { ShopDialog } from "./ShopDialog";
import { PendingPhoto, ReceiptPhoto } from "./ReceiptPhoto";

interface EditLine {
  key: number;
  id?: string;
  label: string;
  productId: string;
  amount: string;
  price: string;
  promo: boolean;
  /** The stored Line needs an amount (ADR 0084); typing one clears it on save. */
  needsAmount?: boolean;
  retyped?: boolean;
}

let nextKey = 1;
const fresh = (over: Partial<EditLine> = {}): EditLine => ({ key: nextKey++, label: "", productId: "", amount: "1", price: "", promo: false, ...over });

/**
 * The one Receipt form (ADR 0082): "Add receipt…" typed in by hand and the
 * register's edit of an existing Receipt. Lifeline reads no photo (ADR 0075);
 * one may be kept beside the Lines, stored only on Save. Lines match to
 * Products here; unmatched ones may be saved and cleared later. The printed
 * total is checked against the sum of Lines and a mismatch is shown, never
 * enforced.
 */
export function ReceiptDialog({ open, onOpenChange, receipt }: { open: boolean; onOpenChange: (o: boolean) => void; receipt?: Receipt | null }) {
  const shops = useShops();
  const products = useProducts();
  const allLines = useLines();
  const existingLines = useMemo(() => (receipt ? linesOf(allLines, receipt.id) : []), [allLines, receipt]);

  const [shopId, setShopId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [branch, setBranch] = useState("");
  const [total, setTotal] = useState("");
  const [noticed, setNoticed] = useState(false);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [newProductFor, setNewProductFor] = useState<number | null>(null);
  const [newShop, setNewShop] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (receipt) {
      setShopId(receipt.shopId);
      setDate(receipt.date);
      setBranch(receipt.branch);
      setTotal(receipt.total > 0 ? editAmount(receipt.total) : "");
      setNoticed(receipt.noticed);
      // Amounts are typed in the matched Product's reading unit; an unmatched Line's stays as stored.
      const shown = (l: Line) => {
        const p = products.find((x) => x.id === l.productId);
        return String(p ? amountIn(l.amount, p) : l.amount);
      };
      setLines(existingLines.map((l) => fresh({ id: l.id, label: l.label, productId: l.productId, amount: shown(l), price: editAmount(l.price), promo: l.promo, needsAmount: l.needsAmount })));
    } else {
      setShopId(shops[0]?.id || "");
      setDate(todayStr());
      setBranch("");
      setTotal("");
      setNoticed(false);
      setLines([fresh()]);
    }
    setPhoto(null);
    // Re-initialising on the existing Lines' arrival is wanted: they load async after the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receipt, existingLines.length, products.length]);

  const parsed = useMemo(() => lines.map((l) => ({ ...l, cents: parseAmount(l.price), amt: Number(l.amount.replace(",", ".")) })), [lines]);
  const sum = sumOfLines(parsed.map((l) => ({ price: l.cents ?? 0 })));
  const totalCents = parseAmount(total);
  const mismatch = totalCents !== null && totalCents > 0 && sum !== totalCents;
  const unmatched = parsed.filter((l) => !l.productId).length;

  const update = (key: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  async function save() {
    const input: LineInput[] = [];
    for (const l of parsed) {
      if (!l.label.trim() && l.cents === null) continue; // an empty row
      if (l.cents === null || l.cents < 0) return void toast.error(`"${l.label || "A line"}" needs a price`);
      if (!(l.amt > 0)) return void toast.error(`"${l.label || "A line"}" needs an amount above zero`);
      const product = products.find((p) => p.id === l.productId);
      input.push({ id: l.id, label: l.label.trim() || product?.title || "", productId: l.productId, amount: product ? fromAmount(l.amt, product) : l.amt, price: l.cents, promo: l.promo, retyped: l.retyped });
    }
    setSaving(true);
    try {
      await saveReceipt({ shopId, date, branch, total: totalCents ?? 0, noticed, photo: photo ?? undefined, lines: input }, shops, products, receipt ? { receipt, lines: existingLines } : undefined);
      toast.success(receipt ? "Receipt saved" : `Receipt saved${unmatched > 0 ? ` — ${unmatched} line${unmatched === 1 ? "" : "s"} to match` : ""}`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!receipt) return;
    await deleteReceipt(receipt.id);
    toast.success("Receipt deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{receipt ? receipt.title : "New receipt"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,220px)]">
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>Shop</Label>
                <ShopSelect value={shopId} onChange={setShopId} shops={shops} onNew={() => setNewShop(true)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rc-date">Day</Label>
                <Input id="rc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rc-branch">Branch</Label>
                <Input id="rc-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="optional" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rc-total">Printed total</Label>
                <Input id="rc-total" value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="none" className={cn(mismatch && "border-amber-500")} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <div className="text-muted-foreground grid grid-cols-[1fr_1fr_64px_80px_28px_28px] items-center gap-1.5 px-1 text-[11px] font-medium tracking-wide uppercase max-md:hidden">
                <span>Label</span>
                <span>Product</span>
                <span>Amount</span>
                <span>Paid</span>
                <span title="Promo">%</span>
                <span />
              </div>
              {lines.map((l) => {
                const product = products.find((p) => p.id === l.productId);
                return (
                  <div key={l.key} className={cn("grid grid-cols-2 items-center gap-1.5 rounded-md border p-1.5 md:grid-cols-[1fr_1fr_64px_80px_28px_28px] md:border-0 md:p-0", !l.productId && "bg-amber-500/5 md:bg-transparent")}>
                    <Input value={l.label} onChange={(e) => update(l.key, { label: e.target.value })} placeholder="As printed" className="h-8 text-sm" />
                    <ProductSelect value={l.productId} onChange={(id) => update(l.key, { productId: id })} products={products} allowNone onNew={() => setNewProductFor(l.key)} className={cn("h-8 text-sm", !l.productId && "border-amber-500/60")} />
                    <Input value={l.amount} onChange={(e) => update(l.key, { amount: e.target.value, retyped: true })} inputMode="decimal" className={cn("text-sm", l.needsAmount && !l.retyped && "border-warning")} aria-invalid={l.needsAmount && !l.retyped ? true : undefined} title={product ? `Amount in ${amountUnit(product)}` : "Amount"} placeholder={product ? amountUnit(product) : undefined} aria-label={product ? `Amount in ${amountUnit(product)}` : "Amount"} />
                    <Input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0,00" className="h-8 text-sm" />
                    <label className="flex items-center justify-center gap-1 text-xs md:justify-start">
                      <Checkbox checked={l.promo} onCheckedChange={(v) => update(l.key, { promo: v === true })} />
                      <span className="md:hidden">Promo</span>
                    </label>
                    <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => removeLine(l.key)} title="Remove line">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, fresh()])}>
                <Plus className="size-3.5" /> Line
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={noticed} onCheckedChange={(v) => setNoticed(v === true)} />
              <span className="min-w-0">Noticed, not bought — a Sighting: it counts for what things cost, never as spending</span>
            </label>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="tabular-nums">
                Lines <span className="font-medium">{formatCents(sum)}</span>
              </span>
              {mismatch && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                  <TriangleAlert className="size-3.5" /> printed total is {formatCents(totalCents ?? 0)} — {formatCents(Math.abs((totalCents ?? 0) - sum))} {sum > (totalCents ?? 0) ? "over" : "missing"}
                </span>
              )}
              {unmatched > 0 && <span className="text-muted-foreground">{unmatched} unmatched</span>}
            </div>
          </div>

          <div className="grid content-start gap-2">
            {photo ? <PendingPhoto file={photo} /> : receipt ? <ReceiptPhoto body={receipt.body} /> : null}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => photoRef.current?.click()}>
              <ImagePlus className="size-3.5" /> {photo ? "Another photo" : "Add photo"}
            </Button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {receipt ? (
            <Button type="button" variant="ghost" onClick={() => void remove()}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={() => void save()} disabled={saving || !shopId || !date}>
            {receipt ? "Save" : "Save receipt"}
          </Button>
        </DialogFooter>
        <ProductDialog open={newProductFor !== null} onOpenChange={(o) => !o && setNewProductFor(null)} defaultTitle={lines.find((l) => l.key === newProductFor)?.label} onCreated={(id) => newProductFor !== null && update(newProductFor, { productId: id })} />
        <ShopDialog open={newShop} onOpenChange={setNewShop} onCreated={setShopId} />
      </DialogContent>
    </Dialog>
  );
}

export type { Line };
