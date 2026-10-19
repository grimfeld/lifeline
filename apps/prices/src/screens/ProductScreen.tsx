import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Badge, Button, Card, CardContent, TagChips, cn } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { PRICES_HREF, type Receipt } from "../domain/types";
import { formatAmount, formatUnitPrice, measureLabel, perUnit } from "../domain/measure";
import { cheapest, historyOf, latestUsual, observe, spanStart, unitPrice, type PricePoint } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useLines, useProduct, useReceipts, useShops } from "../data/repo";
import { PriceChart, shopColor } from "../components/PriceChart";
import { ProductDialog } from "../components/ProductDialog";
import { AddPriceDialog } from "../components/AddPriceDialog";
import { ReceiptDialog } from "../components/ReceiptDialog";

const SPANS: { months: number; label: string }[] = [
  { months: 3, label: "3m" },
  { months: 6, label: "6m" },
  { months: 12, label: "1y" },
  { months: 0, label: "All" },
];

/** One Product (ADR 0082): its unit price per Shop over time, the usual price at each, and every Line behind them. */
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
  const obs = useMemo(() => observe(lines, receipts), [lines, receipts]);
  const history = useMemo(() => (id ? historyOf(id, obs) : new Map<string, PricePoint[]>()), [id, obs]);
  const shown = useMemo(() => {
    if (months === 0) return history;
    const from = spanStart(months, today);
    const out = new Map<string, PricePoint[]>();
    for (const [s, pts] of history) {
      const kept = pts.filter((p) => p.date >= from);
      if (kept.length) out.set(s, kept);
    }
    return out;
  }, [history, months, today]);
  const best = cheapest(history);
  const own = useMemo(() => obs.filter((o) => o.line.productId === id).sort((a, b) => b.date.localeCompare(a.date)), [obs, id]);
  const shopName = (sid: string) => shops.find((s) => s.id === sid)?.title ?? "?";

  if (!product) return <div className="text-muted-foreground p-4 text-sm">That product no longer exists.</div>;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(PRICES_HREF)} title="Back to Prices">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{product.title}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{measureLabel(product)}</span>
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

      {history.size > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...history.entries()]
            .map(([sid, pts]) => ({ sid, usual: latestUsual(pts), n: pts.length }))
            .sort((a, b) => (a.usual?.unit ?? Infinity) - (b.usual?.unit ?? Infinity))
            .map(({ sid, usual, n }) => (
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
                  <div className="text-xl font-semibold tabular-nums">{usual ? formatUnitPrice(usual.unit, product) : "—"}</div>
                  <div className="text-muted-foreground text-xs">{usual ? `usual · ${formatHuman(usual.date)}` : "promo prices only"} · {n} point{n === 1 ? "" : "s"}</div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-2 p-3">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-auto text-xs font-semibold tracking-wide uppercase">Unit price · €{perUnit(product)}</span>
            {SPANS.map((s) => (
              <Button key={s.label} size="sm" variant={months === s.months ? "default" : "ghost"} className="h-7" onClick={() => setMonths(s.months)}>
                {s.label}
              </Button>
            ))}
          </div>
          <PriceChart history={shown} shops={shops} measure={product} />
          <p className="text-muted-foreground text-[11px]">Hollow points are promos — history shows them, the usual price ignores them.</p>
        </CardContent>
      </Card>

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
                    {formatAmount(o.line.amount, product)} · {formatCents(o.line.price)}
                  </span>
                  <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatUnitPrice(unitPrice(o.line), product)}</span>
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
