import { useMemo } from "react";
import { Badge } from "@lifeline/ui";
import type { Document } from "@lifeline/core";
import type { Product } from "../domain/types";
import { cheapest, historyOf, latestUsual, observe } from "../domain/derive";
import { formatUnitPrice } from "../domain/measure";
import { useLines, useReceipts, useShops } from "../data/repo";

/**
 * Prices' Peek (ADR 0057): a Product seen from wherever a link to it was
 * followed — a shopping Need, a note — with the one question it answers
 * without leaving: what it usually costs, and where it is cheapest.
 */
export function ProductPeek({ doc }: { doc: Document }) {
  const p = doc as Product;
  const lines = useLines();
  const receipts = useReceipts();
  const shops = useShops();
  const history = useMemo(() => historyOf(p.id, observe(lines, receipts)), [p.id, lines, receipts]);
  const best = cheapest(history);
  const shopName = (id: string) => shops.find((s) => s.id === id)?.title ?? "?";
  const rows = [...history.entries()]
    .map(([shopId, points]) => ({ shopId, usual: latestUsual(points), last: points[points.length - 1] }))
    .sort((a, b) => (a.usual?.unit ?? Infinity) - (b.usual?.unit ?? Infinity));

  if (rows.length === 0) return <p className="text-muted-foreground text-sm">No price seen yet. Read a receipt that has it.</p>;

  return (
    <div className="flex flex-col gap-4">
      {best && (
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tabular-nums">{formatUnitPrice(best.point.unit, p)}</span>
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
              {r.last?.promo && <Badge variant="outline">promo last</Badge>}
              <span className="tabular-nums">{r.usual ? formatUnitPrice(r.usual.unit, p) : "promo only"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
