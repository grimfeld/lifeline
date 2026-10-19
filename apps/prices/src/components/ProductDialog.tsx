import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { useTagVocabulary } from "@lifeline/core";
import { BASE_UNIT, DIMENSIONS, DIMENSION_LABEL, UNITS_OF, UNIT_LABEL, type Dimension, type Product, type Unit } from "../domain/types";
import { amountUnit, measureLabel, perUnit } from "../domain/measure";
import { linesToRetype } from "../domain/derive";
import { addProduct, deleteProduct, mergeProduct, updateProduct, useLines, useProducts } from "../data/repo";

/**
 * A Product (ADR 0082, 0084): a name and a Measure — a dimension and the unit
 * it is read in, both changeable at any time. A new unit or count name moves
 * no price (amounts are kept in the dimension's base unit); a new dimension
 * applies at once and sends the Product's Lines to the needs-amount inbox,
 * after a confirmation that says how many. A count may wear a name of its
 * own. A Product with prices is merged into any other rather than deleted;
 * into another dimension its Lines arrive needing an amount, again after a
 * confirmation that says how many.
 */
export function ProductDialog({ open, onOpenChange, product, defaultTitle, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; defaultTitle?: string; onCreated?: (id: string) => void }) {
  const products = useProducts();
  const lines = useLines();
  const vocabulary = useTagVocabulary().map((v) => v.tag);
  const [title, setTitle] = useState("");
  const [dimension, setDimension] = useState<Dimension>("count");
  const [unit, setUnit] = useState<Unit>("pc");
  const [countName, setCountName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mergeInto, setMergeInto] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title ?? defaultTitle ?? "");
    setDimension(product?.dimension ?? "count");
    setUnit(product?.unit ?? "pc");
    setCountName(product?.countName ?? "");
    setTags(product?.tags ?? []);
    setMergeInto("");
    setConfirming(false);
  }, [open, product, defaultTitle]);

  const mergeTargets = products.filter((p) => product && p.id !== product.id);
  const into = mergeTargets.find((p) => p.id === mergeInto);

  // Lines that will need an amount: the Product's own when its dimension
  // changes, or — merging — when the target reads in another dimension.
  const retype = product ? linesToRetype(lines, product, into ? into.dimension : dimension).length : 0;
  const lineCount = `${retype} line${retype === 1 ? "" : "s"}`;

  async function save(confirmed = false) {
    if (retype > 0 && !confirmed) return setConfirming(true);
    try {
      if (product) {
        if (into) {
          await mergeProduct(product, into);
          toast.success(`${product.title} merged into ${into.title}${retype > 0 ? ` — ${lineCount} to retype` : ""}`);
        } else {
          await updateProduct(product, { title, dimension, unit, countName, tags });
          if (retype > 0) toast.success(`${title.trim()} is now ${DIMENSION_LABEL[dimension].toLowerCase()} — ${lineCount} to retype`);
        }
      } else onCreated?.(await addProduct({ title, dimension, unit, countName, tags }));
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    if (!product) return;
    try {
      await deleteProduct(product.id);
      toast.success(`${product.title} removed`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product ? product.title : "New product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="product-title">Name</Label>
            <Input id="product-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lait demi-écrémé" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-1.5">
              <Label>Dimension</Label>
              <Select
                value={dimension}
                onValueChange={(v) => {
                  const d = v as Dimension;
                  // Back to the Product's own dimension restores its own unit and name.
                  const own = product && d === product.dimension;
                  setDimension(d);
                  setUnit(own ? product.unit : BASE_UNIT[d]);
                  setCountName(own ? product.countName : "");
                }}
              >
                <SelectTrigger aria-label="Dimension" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIMENSION_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dimension === "count" ? (
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="product-count-name">Counted as</Label>
                <Input id="product-count-name" value={countName} onChange={(e) => setCountName(e.target.value)} placeholder="pieces" />
              </div>
            ) : (
              <div className="grid min-w-0 gap-1.5">
                <Label>Read in</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)} disabled={UNITS_OF[dimension].length < 2}>
                  <SelectTrigger aria-label="Read in" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF[dimension].map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LABEL[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Prices compare €{perUnit({ dimension, unit, countName: countName.trim() })}. {product ? "A new unit or name moves no price." : "Pack size goes on each line, not here. A count can be named: roll, wash, sheet."}
          </p>
          {retype > 0 && !into && (
            <p className="text-warning text-xs" role="status">
              A new dimension: {lineCount} will need an amount, retyped from the inbox. Until then they count as spent but not per unit.
            </p>
          )}
          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={vocabulary} />
          </div>
          {product && mergeTargets.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Merge into another product</Label>
              <Select value={mergeInto || "__none__"} onValueChange={(v) => setMergeInto(v === "__none__" ? "" : v)}>
                <SelectTrigger aria-label="Merge into" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— keep as is —</SelectItem>
                  {mergeTargets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} · {measureLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Its prices and remembered labels move over; this one goes.</p>
              {into && retype > 0 && (
                <p className="text-warning text-xs" role="status">
                  {into.title} is read by {DIMENSION_LABEL[into.dimension].toLowerCase()}: {lineCount} will need an amount in {amountUnit(into)}, retyped from the inbox. Until then they count as spent but not per unit.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {product && (
            <Button type="button" variant="ghost" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button type="button" disabled={!title.trim() && !mergeInto} onClick={() => void save()}>
            {product ? (mergeInto ? "Merge" : "Save") : "Add"}
          </Button>
        </DialogFooter>
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{into ? `Merge ${product?.title} into ${into.title}?` : `Change ${product?.title} to ${DIMENSION_LABEL[dimension].toLowerCase()}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {lineCount} will need an amount{into ? ` in ${amountUnit(into)}, as ${into.title} is read by ${DIMENSION_LABEL[into.dimension].toLowerCase()}` : ""}. The {into ? "merge" : "change"} applies now; each line still counts as spent and stays out of every unit price until you type its amount in the inbox.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="default" onClick={() => void save(true)}>
                {into ? "Merge" : "Change measure"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
