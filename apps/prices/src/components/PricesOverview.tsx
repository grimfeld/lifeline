import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PhoneDock, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { productHref, type Line, type Product, type Receipt, type Shop } from "../domain/types";
import { overviewOf, spanOf } from "../domain/derive";
import { formatCents } from "../domain/money";
import { formatUnitPrice, measureOf } from "../domain/measure";
import { shopColor } from "./PriceChart";
import { Figure, Section } from "./ProductStats";

/** The Overview's own span (ADR 0084), as the Product page's: default 12 months, "All" included. */
const SPANS: { months: number; label: string }[] = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 0, label: "All" },
];

/** How many Products the Spend and Overpaid lists show. */
const TOP = 8;

const pct = (f: number) => `${Math.round(f * 100)}%`;

function Dot({ shopId, shops }: { shopId: string; shops: readonly Shop[] }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(shopId, shops) }} />;
}

/**
 * The Prices screen's fourth reading (spec #161, ADR 0084): Spend, Shops,
 * Overpaid and Promo saved over one span. Every figure comes from
 * overviewOf; this only lays them out.
 */
export function PricesOverview({ products, shops, receipts, lines }: { products: readonly Product[]; shops: readonly Shop[]; receipts: readonly Receipt[]; lines: readonly Line[] }) {
  const navigate = useNavigate();
  const [months, setMonths] = useState(12);
  const today = todayStr();
  const span = useMemo(() => spanOf(months, today), [months, today]);
  const o = useMemo(() => overviewOf(products, receipts, lines, span), [products, receipts, lines, span]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shopName = (id: string) => shops.find((s) => s.id === id)?.title ?? "?";

  const productButton = (id: string) => (
    <button type="button" className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:outline-none" onClick={() => navigate(productHref(id))}>
      {byId.get(id)?.title ?? "?"}
    </button>
  );

  return (
    <div className="grid gap-3">
      <PhoneDock order={1}>
        <ToggleGroup value={String(months)} onValueChange={(v) => setMonths(Number(v))} aria-label="Span" className="justify-self-start">
          {SPANS.map((s) => (
            <ToggleGroupItem key={s.months} value={String(s.months)} aria-label={s.label}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PhoneDock>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Spend">
          <Figure label="Bought" value={formatCents(o.spend.total)} hint="every line bought, unmatched included" />
          {o.spend.top.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing bought in this span.</p>
          ) : (
            <ul className="grid gap-1.5">
              {o.spend.top.slice(0, TOP).map((t) => (
                <li key={t.productId} className="flex items-baseline gap-2 text-sm">
                  {productButton(t.productId)}
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{pct(t.share)}</span>
                  <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatCents(t.spent)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Shops">
          {o.shops.length === 0 ? (
            <p className="text-muted-foreground text-sm">No shop visited in this span.</p>
          ) : (
            <ul className="grid gap-2">
              {o.shops.map((s) => (
                <li key={s.shopId} className="grid gap-0.5">
                  <div className="flex items-baseline gap-2 text-sm">
                    <Dot shopId={s.shopId} shops={shops} />
                    <span className="min-w-0 flex-1 truncate">{shopName(s.shopId)}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatCents(s.spent)}</span>
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {s.visits} visit{s.visits === 1 ? "" : "s"}
                    {s.basket !== null && ` · ${formatCents(Math.round(s.basket))} a basket`}
                    {` · cheapest for ${s.cheapestFor} product${s.cheapestFor === 1 ? "" : "s"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overpaid">
          <Figure label="Overpaid" value={formatCents(o.overpaid.total)} hint="against other shops' usual price" />
          {o.overpaid.top.length === 0 ? (
            <p className="text-muted-foreground text-sm">Never overpaid in this span.</p>
          ) : (
            <ul className="grid gap-2">
              {o.overpaid.top.slice(0, TOP).map((t) => {
                const p = byId.get(t.productId);
                return (
                  <li key={t.productId} className="grid gap-0.5">
                    <div className="flex items-baseline gap-2 text-sm">
                      {productButton(t.productId)}
                      <span className="shrink-0 font-medium tabular-nums">{formatCents(t.total)}</span>
                    </div>
                    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                      <span className="shrink-0">cheapest at</span>
                      <Dot shopId={t.cheapest.shopId} shops={shops} />
                      <span className="min-w-0 truncate">{shopName(t.cheapest.shopId)}</span>
                      {/* The baseline is per unit of the compared-by dimension; with compare-by (#166) read it in that Measure. */}
                      {p && <span className="shrink-0 tabular-nums">· {formatUnitPrice(t.cheapest.unit, measureOf(p))}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Promo saved">
          <Figure label="Saved" value={formatCents(o.promoSaved)} hint="on promos bought, against each shop's usual price" />
        </Section>
      </div>
    </div>
  );
}
