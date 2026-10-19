import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Badge, Button, Card, CardContent, PhoneDock, TagChips, ToggleGroup, ToggleGroupItem, cn } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { PRICES_HREF, type Basis, type Observation, type Receipt } from "../domain/types";
import { formatAmount, formatUnitPrice, measureLabel, measureOf, otherBasis, perUnit, secondaryMeasure } from "../domain/measure";
import { cheapest, comparedBy, historyOf, inSpan, latestUsual, observe, observeAll, spanOf, unitPrice, type PricePoint } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useLines, useProduct, useReceipts, useShops } from "../data/repo";
import { PriceChart, shopColor } from "../components/PriceChart";
import { ProductDialog } from "../components/ProductDialog";
import { AddPriceDialog } from "../components/AddPriceDialog";
import { ReceiptDialog } from "../components/ReceiptDialog";
import { ProductStats } from "../components/ProductStats";

/** The page's one span (ADR 0084): every figure on it reads the same months. */
const SPANS: { months: number; label: string }[] = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 0, label: "All" },
];

/**
 * One Product (ADR 0082): its unit price per Shop over time, the usual price
 * at each, its statistics over one span (ADR 0084), and every Line behind
 * them. A Product with two Measures reads by its compared-by unit — cheapest,
 * chart, statistics — with the other unit price shown beside (ADR 0084).
 */
export function ProductScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useProduct(id);
  const shops = useShops();
  const receipts = useReceipts();
  const lines = useLines();
  const [months, setMonths] = useState(12);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openReceipt, setOpenReceipt] = useState<Receipt | null>(null);

  const today = todayStr();
  const all = useMemo(() => observeAll(lines, receipts), [lines, receipts]);
  const obs = useMemo(() => observe(lines, receipts), [lines, receipts]);
  const span = useMemo(() => spanOf(months, today), [months, today]);
  const history = useMemo(() => (id && product ? historyOf(id, comparedBy(obs, [product])) : new Map<string, PricePoint[]>()), [id, product, obs]);
  const other = product ? otherBasis(product) : undefined;
  const otherHistory = useMemo(() => (id && product && other ? historyOf(id, comparedBy(obs, [product], other)) : undefined), [id, product, other, obs]);
  const shown = useMemo(() => {
    if (!span.from) return history;
    const out = new Map<string, PricePoint[]>();
    for (const [s, pts] of history) {
      const kept = pts.filter((p) => inSpan(p, span));
      if (kept.length) out.set(s, kept);
    }
    return out;
  }, [history, span]);
  const best = cheapest(history);
  const own = useMemo(() => obs.filter((o) => o.line.productId === id).sort((a, b) => b.date.localeCompare(a.date)), [obs, id]);
  const shopName = (sid: string) => shops.find((s) => s.id === sid)?.title ?? "?";

  if (!product) return <div className="text-muted-foreground p-4 text-sm">That product no longer exists.</div>;
  const measure = measureOf(product);
  const otherMeasure = other ? measureOf(product, other) : undefined;
  const second = secondaryMeasure(product);
  /** A Line's unit price on a basis, read in that basis' Measure; null when it has no amount for it. */
  const priceOn = (o: Observation, basis: Basis): string | null => {
    if (o.line.needsAmount) return null;
    const amount = basis === "primary" ? o.line.amount : (o.line.secondAmount ?? 0);
    if (basis === "secondary" && !(amount > 0)) return null;
    return formatUnitPrice(unitPrice({ price: o.line.price, amount }), measureOf(product, basis));
  };
  const leading: Basis = other === "primary" ? "secondary" : "primary";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(PRICES_HREF)} title="Back to Prices">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{product.title}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>
              {measureLabel(product)}
              {second && ` · also ${measureLabel(second).toLowerCase()} · compared €${perUnit(measure)}`}
            </span>
            <TagChips tags={product.tags} size="xs" />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Price
        </Button>
      </div>

      <PhoneDock order={1}>
        <ToggleGroup value={String(months)} onValueChange={(v) => setMonths(Number(v))} aria-label="Span">
          {SPANS.map((s) => (
            <ToggleGroupItem key={s.months} value={String(s.months)} aria-label={s.label}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PhoneDock>

      {history.size > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...history.entries()]
            .map(([sid, pts]) => ({ sid, usual: latestUsual(pts), n: pts.length, otherUsual: latestUsual(otherHistory?.get(sid) ?? []) }))
            .sort((a, b) => (a.usual?.unit ?? Infinity) - (b.usual?.unit ?? Infinity))
            .map(({ sid, usual, n, otherUsual }) => (
              <Card key={sid} className={cn(best?.shopId === sid && "border-emerald-600/50")}>
                <CardContent className="grid gap-0.5 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="size-2 rounded-full" style={{ background: shopColor(sid, shops) }} />
                    {shopName(sid)}
                    {best?.shopId === sid && (
                      <Badge variant="outline" className="ml-auto border-emerald-600/50 text-emerald-600">
                        cheapest
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xl font-semibold tabular-nums">{usual ? formatUnitPrice(usual.unit, measure) : "—"}</span>
                    {otherMeasure && otherUsual && <span className="text-muted-foreground text-sm tabular-nums">{formatUnitPrice(otherUsual.unit, otherMeasure)}</span>}
                  </div>
                  <div className="text-muted-foreground text-xs">{usual ? `usual · ${formatHuman(usual.date)}` : "promo prices only"} · {n} point{n === 1 ? "" : "s"}</div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-2 p-3">
          <h2 className="text-muted-foreground text-sm font-medium">Unit price · €{perUnit(measure)}</h2>
          <PriceChart history={shown} shops={shops} measure={measure} />
          <p className="text-muted-foreground text-[11px]">Hollow points are promos — history shows them, the usual price ignores them.</p>
        </CardContent>
      </Card>

      <ProductStats product={product} shops={shops} all={all} obs={obs} span={span} />

      <div className="grid gap-1">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Every price</span>
        {own.length === 0 ? (
          <p className="text-muted-foreground text-sm">No prices yet — scan a receipt or add one.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {own.map((o) => (
              <li key={o.line.id}>
                <button type="button" className="hover:bg-accent/50 flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm" onClick={() => setOpenReceipt(receipts.find((r) => r.id === o.line.receiptId) ?? null)}>
                  <span className="text-muted-foreground w-24 shrink-0 tabular-nums">{formatHuman(o.date)}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(o.shopId, shops) }} />
                    {shopName(o.shopId)}
                    {o.line.promo && (
                      <Badge variant="outline" className="px-1 text-[10px]">
                        promo
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {o.line.needsAmount ? <span className="text-warning">needs amount</span> : formatAmount(o.line.amount, product)}
                    {second && (o.line.secondAmount ?? 0) > 0 && ` · ${formatAmount(o.line.secondAmount!, second)}`} · {formatCents(o.line.price)}
                  </span>
                  {/* A Line awaiting its amount, or without the compared-by one, says nothing per unit (ADR 0084). */}
                  <span className="grid w-24 shrink-0 text-right tabular-nums">
                    <span className="font-medium">{priceOn(o, leading) ?? "—"}</span>
                    {other && priceOn(o, other) && <span className="text-muted-foreground text-xs">{priceOn(o, other)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProductDialog open={editing} onOpenChange={setEditing} product={product} />
      <AddPriceDialog open={adding} onOpenChange={setAdding} productId={product.id} />
      <ReceiptDialog open={!!openReceipt} onOpenChange={(o) => !o && setOpenReceipt(null)} receipt={openReceipt} />
    </div>
  );
}
