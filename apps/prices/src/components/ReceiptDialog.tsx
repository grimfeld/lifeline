import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, DatePicker, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, cn, toast, Tip } from "@lifeline/ui";
import { initialNumber, initialText, todayStr } from "@lifeline/core";
import { ImagePlus, Plus, TriangleAlert, X } from "lucide-react";
import type { Line, Receipt } from "../domain/types";
import { amountIn, amountUnit, defaultAmount, fromAmount, secondaryMeasure } from "../domain/measure";
import { linesOf, observe, secondPrefill, sumOfLines } from "../domain/derive";
import { editAmount, formatCents, parseAmount, parseNumber } from "../domain/money";
import { deleteReceipt, saveReceipt, useLines, useProducts, useReceipts, useShops, type LineInput } from "../data/repo";
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
  /** The second amount (ADR 0084) in the secondary Measure's reading unit; "" = not measured. */
  second: string;
  /** The second amount was typed (or is the stored one): a new Shop no longer prefills it. */
  secondTyped?: boolean;
  price: string;
  promo: boolean;
  /** The stored Line needs an amount (ADR 0084); typing one clears it on save. */
  needsAmount?: boolean;
  retyped?: boolean;
}

/** What is wrong with a row's fields, shown under the row. */
interface RowErrors {
  amount?: string;
  second?: string;
  price?: string;
}

let nextKey = 1;
const fresh = (over: Partial<EditLine> = {}): EditLine => ({ key: nextKey++, label: "", productId: "", amount: "", second: "", price: "", promo: false, ...over });

/**
 * The one Receipt form (ADR 0082): "Add receipt…" typed in by hand and the
 * register's edit of an existing Receipt. Lifeline reads no photo (ADR 0075);
 * one may be kept beside the Lines, stored only on Save. Lines match to
 * Products here; unmatched ones may be saved and cleared later. A Product
 * with a secondary Measure takes a second amount, prefilled from its last
 * Line at the Shop when it is picked and again when the Shop changes, unless
 * one was typed (ADR 0084). An amount left blank is one for a count only;
 * anything else needs it typed. The printed
 * total is checked against the sum of Lines and a mismatch is shown, never
 * enforced.
 */
export function ReceiptDialog({ open, onOpenChange, receipt, initial }: { open: boolean; onOpenChange: (o: boolean) => void; receipt?: Receipt | null; /** Create mode, the palette's inline line (CommandDialogProps.initial): the Shop, day, branch and total it understood (Lines are not typed inline). */ initial?: Record<string, unknown> }) {
  const shops = useShops();
  const products = useProducts();
  const allLines = useLines();
  const receipts = useReceipts();
  const obs = useMemo(() => observe(allLines, receipts), [allLines, receipts]);
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
  const [errors, setErrors] = useState<ReadonlyMap<number, RowErrors>>(new Map());

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
      const shownSecond = (l: Line) => {
        const p = products.find((x) => x.id === l.productId);
        const m = p && secondaryMeasure(p);
        return m && (l.secondAmount ?? 0) > 0 ? String(amountIn(l.secondAmount!, m)) : "";
      };
      // A stored second amount — or its absence — stays as it was, whatever the Shop.
      setLines(existingLines.map((l) => fresh({ id: l.id, label: l.label, productId: l.productId, amount: shown(l), second: shownSecond(l), secondTyped: true, price: editAmount(l.price), promo: l.promo, needsAmount: l.needsAmount })));
    } else {
      const printed = initialNumber(initial, "total");
      setShopId(initialText(initial, "shop") || shops[0]?.id || "");
      setDate(initialText(initial, "date") || todayStr());
      setBranch(initialText(initial, "branch"));
      setTotal(printed === undefined ? "" : String(printed));
      setNoticed(false);
      setLines([fresh()]);
    }
    setPhoto(null);
    setErrors(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-initialising on the existing Lines' arrival is wanted: they load async after the dialog opens
  }, [open, receipt, existingLines.length, products.length, initial]);

  // Each untyped second amount follows the Shop: that Product's last pack there.
  useEffect(() => {
    setLines((ls) =>
      ls.map((l) => {
        if (l.secondTyped) return l;
        const v = secondPrefill(obs, products.find((p) => p.id === l.productId), shopId);
        const second = v === undefined ? "" : String(v);
        return second === l.second ? l : { ...l, second };
      }),
    );
  }, [shopId, obs, products]);

  const parsed = useMemo(() => lines.map((l) => ({ ...l, cents: parseAmount(l.price), amt: parseNumber(l.amount), secondAmt: parseNumber(l.second) })), [lines]);
  const sum = sumOfLines(parsed.map((l) => ({ price: l.cents ?? 0 })));
  const totalCents = parseAmount(total);
  const mismatch = totalCents !== null && totalCents > 0 && sum !== totalCents;
  const unmatched = parsed.filter((l) => !l.productId).length;

  /** Edit a row; editing a field clears its error. */
  const update = (key: number, patch: Partial<EditLine>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setErrors((m) => {
      const e = m.get(key);
      if (!e) return m;
      const left = { ...e };
      for (const f of ["amount", "second", "price"] as const) if (f in patch) delete left[f];
      return new Map(m).set(key, left);
    });
  };
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));
  /** A Line's Product picked: its second amount starts from that Product's last pack at this Shop. */
  const pick = (key: number, productId: string) => {
    const v = secondPrefill(obs, products.find((x) => x.id === productId), shopId);
    update(key, { productId, second: v === undefined ? "" : String(v), secondTyped: false });
  };

  async function save() {
    const input: LineInput[] = [];
    const found = new Map<number, RowErrors>();
    for (const l of parsed) {
      if (!l.label.trim() && l.cents === null) continue; // an empty row
      const product = products.find((p) => p.id === l.productId);
      const secondM = product && secondaryMeasure(product);
      // Blank is one for a count only; anything weighed, poured or measured — or not matched yet — needs it typed.
      const amt = l.amt ?? defaultAmount(product);
      const e: RowErrors = {};
      if (l.cents === null || l.cents < 0) e.price = "Type the price paid";
      if (amt === undefined) e.amount = `Type the amount${product ? `, in ${amountUnit(product)}` : ""}`;
      else if (!(amt > 0)) e.amount = "The amount is above zero";
      if (secondM && l.second.trim() && !(l.secondAmt !== null && l.secondAmt >= 0)) e.second = "The second amount is a number, or empty when not measured";
      if (amt === undefined || l.cents === null || Object.keys(e).length > 0) {
        found.set(l.key, e);
        continue;
      }
      // Shown prefilled, so an empty field is "not measured", never "prefill".
      const secondAmount = secondM ? (l.secondAmt !== null && l.secondAmt > 0 ? fromAmount(l.secondAmt, secondM) : 0) : undefined;
      input.push({ id: l.id, label: l.label.trim() || product?.title || "", productId: l.productId, amount: product ? fromAmount(amt, product) : amt, secondAmount, price: l.cents, promo: l.promo, retyped: l.retyped });
    }
    setErrors(found);
    if (found.size > 0) return;
    setSaving(true);
    try {
      await saveReceipt({ shopId, date, branch, total: totalCents ?? 0, noticed, photo: photo ?? undefined, lines: input }, shops, products, receipt ? { receipt, lines: existingLines } : undefined);
      toast.success(receipt ? "Receipt saved" : `Receipt saved${unmatched > 0 ? ` — ${unmatched} line${unmatched === 1 ? "" : "s"} to match` : ""}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`The receipt was not saved: ${(e as Error).message}`);
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
                <DatePicker id="rc-date" required value={date} onChange={setDate} />
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
              <div className="text-muted-foreground grid grid-cols-[1fr_1fr_64px_64px_80px_28px_28px] items-center gap-1.5 px-1 text-xs font-medium max-md:hidden">
                <span>Label</span>
                <span>Product</span>
                <span>Amount</span>
                <span title="Second amount, for a product also weighed or measured">Also</span>
                <span>Paid</span>
                <span title="Promo">%</span>
                <span />
              </div>
              {lines.map((l) => {
                const product = products.find((p) => p.id === l.productId);
                const secondM = product && secondaryMeasure(product);
                const err = errors.get(l.key) ?? {};
                const errId = `rc-line-${l.key}-error`;
                const said = [err.amount, err.second, err.price].filter(Boolean);
                return (
                  <div key={l.key} className={cn("grid grid-cols-2 items-center gap-1.5 rounded-md border p-1.5 md:grid-cols-[1fr_1fr_64px_64px_80px_28px_28px] md:border-0 md:p-0", !l.productId && "bg-warning/5 md:bg-transparent")}>
                    <Input aria-label="Item as printed" value={l.label} onChange={(e) => update(l.key, { label: e.target.value })} placeholder="As printed" className="text-sm" />
                    <ProductSelect value={l.productId} onChange={(id) => pick(l.key, id)} products={products} allowNone onNew={() => setNewProductFor(l.key)} className={cn("h-8 text-sm", !l.productId && "border-warning/60")} />
                    <Input value={l.amount} onChange={(e) => update(l.key, { amount: e.target.value, retyped: true })} inputMode="decimal" className={cn("text-sm", l.needsAmount && !l.retyped && "border-warning")} aria-invalid={err.amount || (l.needsAmount && !l.retyped) ? true : undefined} aria-describedby={err.amount ? errId : undefined} title={product ? `Amount in ${amountUnit(product)}` : "Amount"} placeholder={defaultAmount(product) ? "1" : product ? amountUnit(product) : "Amount"} aria-label={product ? `Amount in ${amountUnit(product)}` : "Amount"} />
                    {secondM ? (
                      <Input value={l.second} onChange={(e) => update(l.key, { second: e.target.value, secondTyped: true })} inputMode="decimal" className="text-sm" aria-invalid={err.second ? true : undefined} aria-describedby={err.second ? errId : undefined} placeholder={amountUnit(secondM)} title={`Also measured, in ${amountUnit(secondM)}`} aria-label={`Second amount in ${amountUnit(secondM)}`} />
                    ) : (
                      <span className="max-md:hidden" />
                    )}
                    <Input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0,00" className="text-sm" aria-label="Price paid" aria-invalid={err.price ? true : undefined} aria-describedby={err.price ? errId : undefined} />
                    <label className="flex items-center justify-center gap-1 text-xs md:justify-start">
                      <Checkbox checked={l.promo} onCheckedChange={(v) => update(l.key, { promo: v === true })} />
                      <span className="md:hidden">Promo</span>
                    </label>
                    <Tip label="Remove line">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(l.key)}>
                        <X className="size-3.5" />
                      </Button>
                    </Tip>
                    {said.length > 0 && (
                      <p id={errId} className="text-destructive col-span-full text-xs">
                        {said.join(" · ")}
                      </p>
                    )}
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
        <ProductDialog open={newProductFor !== null} onOpenChange={(o) => !o && setNewProductFor(null)} defaultTitle={lines.find((l) => l.key === newProductFor)?.label} onCreated={(id) => newProductFor !== null && pick(newProductFor, id)} />
        <ShopDialog open={newShop} onOpenChange={setNewShop} onCreated={setShopId} />
      </DialogContent>
    </Dialog>
  );
}

export type { Line };
