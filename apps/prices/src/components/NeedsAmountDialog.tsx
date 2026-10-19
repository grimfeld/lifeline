import { useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { Check } from "lucide-react";
import type { Line, Product, Receipt, Shop } from "../domain/types";
import { amountUnit } from "../domain/measure";
import { needingAmount } from "../domain/derive";
import { formatCents } from "../domain/money";
import { setLineAmount } from "../data/repo";

/**
 * The needs-amount inbox (ADR 0084): Lines whose Product changed dimension,
 * each retyped one at a time in the Product's new reading unit. Until then a
 * Line counts as spent and says nothing per unit; nothing here blocks.
 */
export function NeedsAmountDialog({ open, onOpenChange, lines, products, receipts, shops }: { open: boolean; onOpenChange: (o: boolean) => void; lines: readonly Line[]; products: readonly Product[]; receipts: readonly Receipt[]; shops: readonly Shop[] }) {
  const rows = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const receiptById = new Map(receipts.map((r) => [r.id, r]));
    return needingAmount(lines)
      .map((line) => ({ line, product: productById.get(line.productId), receipt: receiptById.get(line.receiptId) }))
      .filter((r): r is { line: Line; product: Product; receipt: Receipt | undefined } => !!r.product)
      .sort((a, b) => a.product.title.localeCompare(b.product.title) || (b.receipt?.date ?? "").localeCompare(a.receipt?.date ?? ""));
  }, [lines, products, receipts]);
  const shopName = (id: string | undefined) => shops.find((s) => s.id === id)?.title ?? "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lines that need an amount</DialogTitle>
          <DialogDescription>These Products changed measure. Type each pack's real amount; until then a Line counts as spent but is left out of every unit price.</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing left to retype.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map(({ line, product, receipt }) => (
              <AmountRow key={line.id} line={line} product={product} where={receipt ? `${shopName(receipt.shopId)} · ${formatHuman(receipt.date)}` : ""} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AmountRow({ line, product, where }: { line: Line; product: Product; where: string }) {
  const [value, setValue] = useState("");
  const typed = Number(value.replace(",", "."));
  const unit = amountUnit(product);

  async function save() {
    try {
      await setLineAmount(line, typed, product);
      toast.success(`${product.title}: amount saved`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <div className="grid min-w-0 flex-1 basis-40">
        <span className="truncate font-medium">{product.title}</span>
        <span className="text-muted-foreground truncate text-xs">
          {where}
          {where && " · "}
          {line.label && line.label !== product.title ? `${line.label} · ` : ""}
          <span className="tabular-nums">{formatCents(line.price)}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && typed > 0 && void save()} inputMode="decimal" placeholder="Amount" aria-label={`${product.title}: amount in ${unit}`} className="w-24" />
        <span className="text-muted-foreground w-10 truncate text-xs">{unit}</span>
        <Button type="button" size="icon-sm" variant="outline" disabled={!(typed > 0)} onClick={() => void save()} aria-label={`Save the amount of ${product.title}`}>
          <Check />
        </Button>
      </div>
    </li>
  );
}
