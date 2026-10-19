import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { useTagVocabulary } from "@lifeline/core";
import { BASE_UNIT, DIMENSIONS, DIMENSION_LABEL, UNITS_OF, UNIT_LABEL, type Dimension, type Product, type Unit } from "../domain/types";
import { perUnit } from "../domain/measure";
import { addProduct, deleteProduct, mergeProduct, updateProduct, useProducts } from "../data/repo";

/**
 * A Product (ADR 0082, 0084): a name and a Measure — a dimension, fixed once
 * made, and the unit it is read in, which may change at any time (amounts are
 * kept in the dimension's base unit, so no price moves). A count may wear a
 * name of its own. A Product with prices is merged into another of the same
 * dimension rather than deleted.
 */
export function ProductDialog({ open, onOpenChange, product, defaultTitle, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; defaultTitle?: string; onCreated?: (id: string) => void }) {
  const products = useProducts();
  const vocabulary = useTagVocabulary().map((v) => v.tag);
  const [title, setTitle] = useState("");
  const [dimension, setDimension] = useState<Dimension>("count");
  const [unit, setUnit] = useState<Unit>("pc");
  const [countName, setCountName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mergeInto, setMergeInto] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title ?? defaultTitle ?? "");
    setDimension(product?.dimension ?? "count");
    setUnit(product?.unit ?? "pc");
    setCountName(product?.countName ?? "");
    setTags(product?.tags ?? []);
    setMergeInto("");
  }, [open, product, defaultTitle]);

  const mergeTargets = products.filter((p) => product && p.id !== product.id && p.dimension === product.dimension);

  async function save() {
    try {
      if (product) {
        if (mergeInto) {
          const into = products.find((p) => p.id === mergeInto);
          if (!into) return;
          await mergeProduct(product, into);
          toast.success(`${product.title} merged into ${into.title}`);
        } else await updateProduct(product, { title, unit, countName, tags });
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
                  setDimension(v as Dimension);
                  setUnit(BASE_UNIT[v as Dimension]);
                  setCountName("");
                }}
                disabled={!!product}
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
            Prices compare €{perUnit({ dimension, unit, countName: countName.trim() })}. {product ? "The dimension stays; the unit or name can change any time — no price moves." : "Pack size goes on each line, not here. A count can be named: roll, wash, sheet."}
          </p>
          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={vocabulary} />
          </div>
          {product && mergeTargets.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Merge into another product</Label>
              <Select value={mergeInto || "__none__"} onValueChange={(v) => setMergeInto(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— keep as is —</SelectItem>
                  {mergeTargets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Its prices and remembered labels move over; this one goes.</p>
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
      </DialogContent>
    </Dialog>
  );
}
