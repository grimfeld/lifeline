import { useMemo, useState } from "react";
import { Badge, Button, CommitField } from "@lifeline/ui";
import type { Document } from "@lifeline/core";
import { Pencil, Plus } from "lucide-react";
import type { Product, Receipt, Shop } from "../domain/types";
import { cheapest, comparedBy, historyOf, latestUsual, linesOf, observe, sumOfLines } from "../domain/derive";
import { formatUnitPrice, measureLabel, measureOf } from "../domain/measure";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { editReceipt, updateShop, useLines, useProduct, useReceipts, useShops } from "../data/repo";
import { AddPriceDialog } from "./AddPriceDialog";
import { ProductDialog } from "./ProductDialog";
import { ReceiptDialog } from "./ReceiptDialog";

/**
 * Prices' Peeks (ADR 0057, editable by ADR 0085): a Product, a Receipt or a
 * Shop seen from wherever a link to it was followed — a shopping Need, a
 * note, a Base — each with its own Fields edited in place through the App's
 * operations and its main operations one tap away.
 */

/**
 * A Product: what it usually costs and where it is cheapest. Its Measure is
 * guarded (CONTEXT.md "Product") and changed only in the Product dialog, so
 * it is shown, not edited; a price is added here, and merging or deleting is the Product's
 * dialog.
 */
export function ProductPeek({ doc }: { doc: Document }) {
  // Normalised, so a Product stored before compare-by still reads its Measure.
  const p = useProduct(doc.id) ?? (doc as Product);
  const lines = useLines();
  const receipts = useReceipts();
  const shops = useShops();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const history = useMemo(() => historyOf(p.id, comparedBy(observe(lines, receipts), [p])), [p, lines, receipts]);
  const measure = measureOf(p);
  const best = cheapest(history);
  const shopName = (id: string) => shops.find((s) => s.id === id)?.title ?? "?";
  const rows = [...history.entries()]
    .map(([shopId, points]) => ({ shopId, usual: latestUsual(points), last: points[points.length - 1] }))
    .sort((a, b) => (a.usual?.unit ?? Infinity) - (b.usual?.unit ?? Infinity));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Badge variant="secondary">{measureLabel(measure)}</Badge>
        <span>every price compared per this unit</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No price seen yet. Read a receipt that has it, or add one.</p>
      ) : (
        <>
          {best && (
            <div className="flex flex-col">
              <span className="text-2xl font-semibold tabular-nums">{formatUnitPrice(best.point.unit, measure)}</span>
              <span className="text-muted-foreground text-sm">
                cheapest at {shopName(best.shopId)} · {best.point.date}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Usual price by shop</span>
            <ul className="flex flex-col text-sm">
              {rows.map((r) => (
                <li key={r.shopId} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
                  <span className="min-w-0 flex-1 truncate">{shopName(r.shopId)}</span>
                  {r.last?.promo && (
                    <Badge variant="outline" className="shrink-0">
                      promo last
                    </Badge>
                  )}
                  <span className="shrink-0 tabular-nums">{r.usual ? formatUnitPrice(r.usual.unit, measure) : "promo only"}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add price
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Rename or merge…
        </Button>
      </div>
      <AddPriceDialog open={adding} onOpenChange={setAdding} productId={p.id} />
      <ProductDialog open={editing} onOpenChange={setEditing} product={p} />
    </div>
  );
}

/**
 * A Receipt: its day, branch and printed total edited in place (`editReceipt`
 * retitles it and refuses a twin); its Shop is guarded and its Lines are the
 * Receipt dialog's, one tap away.
 */
export function ReceiptPeek({ doc }: { doc: Document }) {
  const r = doc as Receipt;
  const shops = useShops();
  const lines = linesOf(useLines(), r.id);
  const [editing, setEditing] = useState(false);
  const shop = shops.find((s) => s.id === r.shopId);
  const sum = sumOfLines(lines);
  const total = Number(r.total) || 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
        <span className="min-w-0 truncate">{shop?.title ?? "No shop"}</span>
        <span className="shrink-0 tabular-nums">
          · {lines.length} line{lines.length === 1 ? "" : "s"} · {formatCents(sum)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Day" type="date" value={r.date ?? ""} onCommit={(date) => editReceipt(r, { date }, shops)} />
        <CommitField
          label="Printed total"
          inputMode="decimal"
          value={total ? editAmount(total) : ""}
          hint={total && total !== sum ? `Lines add up to ${formatCents(sum)}` : undefined}
          onCommit={(text) => {
            const cents = text.trim() ? parseAmount(text) : 0;
            if (cents === null || cents < 0) throw new Error("The total must be an amount");
            return editReceipt(r, { total: cents }, shops);
          }}
        />
      </div>
      <CommitField label="Branch" value={r.branch ?? ""} placeholder="Rue de la Paix" onCommit={(branch) => editReceipt(r, { branch }, shops)} />
      {lines.length > 0 && (
        <ul className="flex flex-col text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 border-b py-1 last:border-0">
              <span className="min-w-0 flex-1 truncate">{l.label || "Line"}</span>
              <span className="shrink-0 tabular-nums">{formatCents(l.price)}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Edit lines…
        </Button>
      </div>
      <ReceiptDialog open={editing} onOpenChange={setEditing} receipt={r} />
    </div>
  );
}

/** A Shop — a chain: its note edited in place (`updateShop`). */
export function ShopPeek({ doc }: { doc: Document }) {
  const shop = doc as Shop;
  const receipts = useReceipts().filter((r) => r.shopId === shop.id);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {receipts.length === 0 ? "No receipts yet." : `${receipts.length} receipt${receipts.length === 1 ? "" : "s"}, the last on ${receipts.map((r) => r.date).sort().at(-1)}.`}
      </p>
      <CommitField label="Note" value={shop.note ?? ""} placeholder="Loyalty card in the drawer" onCommit={(note) => updateShop(shop, { title: shop.title, note })} />
    </div>
  );
}
