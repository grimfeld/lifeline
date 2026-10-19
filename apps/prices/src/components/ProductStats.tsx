import { useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import type { Observation, Product, Shop } from "../domain/types";
import { overpaidOf, promoOf, rhythmOf, spendOf, spreadOf, type PriceStats, type Span } from "../domain/derive";
import { formatCents } from "../domain/money";
import { formatAmount, formatUnitPrice } from "../domain/measure";
import { shopColor } from "./PriceChart";

const pct = (f: number) => `${Math.round(f * 100)}%`;

/** One figure: a label above, the number, a quiet line under. */
export function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-3">
        <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * A Product's statistics over the page's one span (spec #161, ADR 0084):
 * spend and share, buying rhythm, price spread, promos, Overpaid. Every figure comes
 * from derive.ts; this only lays them out.
 */
export function ProductStats({ product, shops, all, obs, span }: { product: Product; shops: readonly Shop[]; all: readonly Observation[]; obs: readonly Observation[]; span: Span }) {
  const spend = useMemo(() => spendOf(product.id, all, span), [product.id, all, span]);
  const rhythm = useMemo(() => rhythmOf(product.id, obs, span), [product.id, obs, span]);
  const spread = useMemo(() => spreadOf(product.id, obs, span), [product.id, obs, span]);
  const promo = useMemo(() => promoOf(product.id, obs, span), [product.id, obs, span]);
  const overpaid = useMemo(() => overpaidOf(product.id, obs, span), [product.id, obs, span]);
  const unit = (cents: number) => formatUnitPrice(cents, product);
  const shopName = (id: string) => shops.find((s) => s.id === id)?.title ?? "?";
  const range = (s: PriceStats) => (s.n === 1 ? `${s.n} price` : `low ${unit(s.min)} · avg ${unit(s.avg)} · high ${unit(s.max)} · ${s.n} prices`);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Section title="Spend">
        <div className="grid grid-cols-2 gap-3">
          <Figure label="Spent" value={formatCents(spend.spent)} />
          <Figure label="Share" value={spend.share === null ? "—" : pct(spend.share)} hint={spend.total > 0 ? `of ${formatCents(spend.total)} bought` : "nothing bought"} />
        </div>
      </Section>

      <Section title="Buying rhythm">
        <div className="grid grid-cols-2 gap-3">
          <Figure label="Times bought" value={rhythm.times} />
          <Figure label="Average gap" value={rhythm.avgGapDays === null ? "—" : `${Math.round(rhythm.avgGapDays)} d`} />
          <Figure label="Last bought" value={rhythm.last ? formatHuman(rhythm.last) : "—"} />
          <Figure label="Per month" value={rhythm.perMonth === null ? "—" : formatAmount(rhythm.perMonth, product)} />
        </div>
      </Section>

      <Section title="Price spread">
        {spread.overall ? (
          <ul className="grid gap-2">
            <li className="grid gap-0.5">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">Every shop</span>
                <span className="shrink-0 font-semibold tabular-nums">{unit(spread.overall.median)}</span>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">median · {range(spread.overall)}</span>
            </li>
            {spread.perShop.map(({ shopId, stats }) => (
              <li key={shopId} className="grid gap-0.5">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(shopId, shops) }} />
                  <span className="min-w-0 flex-1 truncate">{shopName(shopId)}</span>
                  <span className="shrink-0 tabular-nums">{unit(stats.median)}</span>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">{range(stats)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No prices in this span.</p>
        )}
      </Section>

      <Section title="Promos">
        <div className="grid grid-cols-2 gap-3">
          <Figure label="On promo" value={promo.frequency === null ? "—" : pct(promo.frequency)} hint={`${promo.promos} of ${promo.n} prices`} />
          <Figure label="Average discount" value={promo.avgDiscount === null ? "—" : pct(promo.avgDiscount)} hint="off the usual price" />
          <Figure label="Promo saving" value={formatCents(promo.saving)} hint="on what I bought" />
        </div>
      </Section>

      <Section title="Overpaid">
        <div className="grid grid-cols-2 gap-3">
          <Figure label="Overpaid" value={formatCents(overpaid.total)} hint="against other shops' usual price" />
          {overpaid.cheapest ? (
            <Figure
              label="Cheapest at"
              value={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(overpaid.cheapest.shopId, shops) }} />
                  <span className="min-w-0 truncate">{shopName(overpaid.cheapest.shopId)}</span>
                </span>
              }
              hint={`${unit(overpaid.cheapest.unit)} · ${formatHuman(overpaid.cheapest.date)}`}
            />
          ) : (
            <Figure label="Cheapest at" value="—" hint="never overpaid in this span" />
          )}
        </div>
      </Section>
    </div>
  );
}
