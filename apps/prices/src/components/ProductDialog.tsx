import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { useTagVocabulary } from "@lifeline/core";
import { MEASURES, MEASURE_LABEL, type Measure, type Product } from "../domain/types";
import { addProduct, deleteProduct, mergeProduct, updateProduct, useProducts } from "../data/repo";

/**
 * A Product (ADR 0045): a name and a measure fixed at creation. Editing
 * renames; a Product with prices is merged into another of the same measure
 * rather than deleted.
 */
export function ProductDialog({ open, onOpenChange, product, defaultTitle, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; defaultTitle?: string; onCreated?: (id: string) => void }) {
  const products = useProducts();
  const vocabulary = useTagVocabulary().map((v) => v.tag);
  const [title, setTitle] = useState("");
  const [measure, setMeasure] = useState<Measure>("piece");
  const [tags, setTags] = useState<string[]>([]);
  const [mergeInto, setMergeInto] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title ?? defaultTitle ?? "");
    setMeasure(product?.measure ?? "piece");
    setTags(product?.tags ?? []);
    setMergeInto("");
  }, [open, product, defaultTitle]);

  const mergeTargets = products.filter((p) => product && p.id !== product.id && p.measure === product.measure);

  async function save() {
    try {
      if (product) {
        if (mergeInto) {
          const into = products.find((p) => p.id === mergeInto);
          if (!into) return;
          await mergeProduct(product, into);
          toast.success(`${product.title} merged into ${into.title}`);
        } else await updateProduct(product, { title, tags });
      } else onCreated?.(await addProduct({ title, measure, tags }));
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
          <div className="grid gap-1.5">
            <Label>Measure</Label>
            <Select value={measure} onValueChange={(v) => setMeasure(v as Measure)} disabled={!!product}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEASURES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MEASURE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{product ? "Fixed — every price of this product is per this unit." : "Every price is compared per kilo, per litre or per piece. Pack size goes on each line, not here."}</p>
          </div>
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
