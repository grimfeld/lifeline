import { useMemo } from "react";
import { Link } from "react-router";
import { CardUnavailable } from "@lifeline/ui";
import type { CardOption, CardProps, CardSettings } from "@lifeline/core";
import { productHref } from "../domain/types";
import { cheapest, comparedBy, historyOf, latestUsual, observe } from "../domain/derive";
import { formatUnitPrice, measureOf } from "../domain/measure";
import { useLines, useProducts, useReceipts, useShops } from "../data/repo";
import { PriceChart, shopColor } from "../components/PriceChart";

/** Options hook for the `product` setting: every Product by name. */
export function useProductOptions(): CardOption[] {
  return useProducts().map((p) => ({ value: p.id, label: p.title }));
}

/** Instance title: the chosen Product's name. */
export function useProductCardTitle(settings: CardSettings): string {
  return useProducts().find((p) => p.id === settings.product)?.title ?? "";
}

/** Product price (ADR 0082): the cheapest Shop's usual price, every Shop's beside it, and the sparkline of all of them — in the Product's compared-by unit (ADR 0084). */
export function ProductPriceCard({ settings, configure }: CardProps) {
  const id = settings.product as string;
  const products = useProducts();
  const shops = useShops();
  const receipts = useReceipts();
  const lines = useLines();
  const product = products.find((p) => p.id === id);
  const history = useMemo(() => historyOf(id, comparedBy(observe(lines, receipts), product ? [product] : [])), [id, product, lines, receipts]);
  if (!product) return <CardUnavailable message="That product no longer exists." onConfigure={configure} />;
  const measure = measureOf(product);
  const best = cheapest(history);
  const others = [...history.entries()].map(([sid, pts]) => ({ sid, usual: latestUsual(pts) })).filter((r) => r.usual && r.sid !== best?.shopId);
  return (
    <Link
      to={productHref(product.id)}
      draggable={false}
      className="hover:bg-accent/40 focus-visible:ring-ring flex h-full flex-col gap-1 rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="sr-only">{product.title}</span>
      {best ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-2xl font-semibold tabular-nums">{formatUnitPrice(best.point.unit, measure)}</span>
          <span className="flex items-center gap-1 text-xs">
            <span className="size-2 rounded-full" style={{ background: shopColor(best.shopId, shops) }} />
            {shops.find((s) => s.id === best.shopId)?.title ?? "?"}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">No usual price yet.</span>
      )}
      {others.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap gap-x-3 text-[11px] tabular-nums">
          {others.map((o) => (
            <span key={o.sid} className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: shopColor(o.sid, shops) }} />
              {formatUnitPrice(o.usual!.unit, measure)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto min-h-0 flex-1">
        <PriceChart history={history} shops={shops} measure={measure} height={72} compact />
      </div>
    </Link>
  );
}
