import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge, Button, Input, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { Camera, Inbox, Pencil, Plus, Tag, TriangleAlert } from "lucide-react";
import { MEASURE_UNIT, productHref, type Receipt, type Shop } from "../domain/types";
import { cheapest, formatUnitPrice, historyOf, isUnmatched, linesOf, observe, overallChange, shopChanges, spanStart, sumOfLines, totalMismatch } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useLines, useProducts, useReceipts, useShops } from "../data/repo";
import { ProductDialog } from "../components/ProductDialog";
import { ShopDialog } from "../components/ShopDialog";
import { ReceiptDialog } from "../components/ReceiptDialog";
import { ScanReceiptDialog } from "../components/ScanReceiptDialog";
import { AddPriceDialog } from "../components/AddPriceDialog";
import { shopColor } from "../components/PriceChart";

const SPANS = [
  { months: 3, label: "Last 3 months" },
  { months: 6, label: "Last 6 months" },
  { months: 12, label: "Last 12 months" },
];

function Pct({ v }: { v: number }) {
  const sign = v > 0 ? "+" : "";
  return <span className={cn("font-medium tabular-nums", v > 0.5 && "text-rose-600/90", v < -0.5 && "text-emerald-600/90")}>{`${sign}${v.toFixed(1)}%`}</span>;
}

/**
 * Prices (ADR 0045): Products with their cheapest Shop, the Receipt
 * register with the unmatched inbox one tap away, the price change reading
 * per Shop, and the Shops themselves.
 */
export function PricesScreen() {
  const navigate = useNavigate();
  const products = useProducts();
  const shops = useShops();
  const receipts = useReceipts();
  const lines = useLines();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "products";

  const [search, setSearch] = useState("");
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [months, setMonths] = useState(6);
  const [scanOpen, setScanOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [newReceipt, setNewReceipt] = useState(false);
  const [openReceipt, setOpenReceipt] = useState<Receipt | null>(null);
  const [newProduct, setNewProduct] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [newShop, setNewShop] = useState(false);

  const today = todayStr();
  const obs = useMemo(() => observe(lines, receipts), [lines, receipts]);
  const shopName = (id: string) => shops.find((s) => s.id === id)?.title ?? "?";
  const unmatchedByReceipt = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) if (isUnmatched(l)) m.set(l.receiptId, (m.get(l.receiptId) ?? 0) + 1);
    return m;
  }, [lines]);
  const unmatchedTotal = useMemo(() => [...unmatchedByReceipt.values()].reduce((a, b) => a + b, 0), [unmatchedByReceipt]);

  const productRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .map((p) => {
        const h = historyOf(p.id, obs);
        const n = [...h.values()].reduce((s, pts) => s + pts.length, 0);
        return { p, best: cheapest(h), n, shops: h.size };
      });
  }, [products, obs, search]);

  const receiptRows = useMemo(
    () =>
      [...receipts]
        .filter((r) => !onlyUnmatched || (unmatchedByReceipt.get(r.id) ?? 0) > 0)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .map((r) => {
          const ls = linesOf(lines, r.id);
          return { r, ls, sum: sumOfLines(ls), mismatch: totalMismatch(r, ls), unmatched: unmatchedByReceipt.get(r.id) ?? 0 };
        }),
    [receipts, lines, onlyUnmatched, unmatchedByReceipt],
  );

  const from = spanStart(months, today);
  const changeRows = useMemo(() => products.map((p) => ({ p, changes: shopChanges(p.id, obs, from, today) })).filter((r) => r.changes.length > 0), [products, obs, from, today]);
  const overall = useMemo(() => overallChange(products.map((p) => p.id), obs, from, today), [products, obs, from, today]);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="size-5" />
        <h1 className="mr-auto text-lg font-semibold">Prices</h1>
        <PhoneDock row className="justify-end">
          <Button variant="outline" onClick={() => setPriceOpen(true)} disabled={products.length === 0 && shops.length === 0}>
            <Plus /> Price
          </Button>
          <Button onClick={() => setScanOpen(true)}>
            <Camera /> Scan receipt
          </Button>
        </PhoneDock>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === "products" ? {} : { tab: v }, { replace: true })}>
        <PhoneDock row order={1}>
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="receipts">
              Receipts
              {unmatchedTotal > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5">
                  {unmatchedTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="change">Change</TabsTrigger>
            <TabsTrigger value="shops">Shops</TabsTrigger>
          </TabsList>
        </PhoneDock>

        <TabsContent value="products" className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 empty:hidden">
            <PhoneDock row>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-56 min-w-0 max-md:flex-1" />
              <Button variant="outline" className="ml-auto" onClick={() => setNewProduct(true)}>
                <Plus /> Product
              </Button>
            </PhoneDock>
          </div>
          {productRows.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              {products.length === 0 ? "No products yet. Scan a receipt, or add a product and a price by hand." : "Nothing matches."}
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {productRows.map(({ p, best, n, shops: nShops }) => (
                <li key={p.id}>
                  <button type="button" className="hover:bg-accent/50 flex w-full items-center gap-3 px-3 py-2 text-left text-sm" onClick={() => navigate(productHref(p.id))}>
                    <span className="min-w-0 flex-1 truncate">
                      {p.title} <span className="text-muted-foreground text-xs">· {MEASURE_UNIT[p.measure]}</span>
                    </span>
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {n} price{n === 1 ? "" : "s"} · {nShops} shop{nShops === 1 ? "" : "s"}
                    </span>
                    {best ? (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <span className="size-2 rounded-full" style={{ background: shopColor(best.shopId, shops) }} />
                        <span className="text-muted-foreground max-w-24 truncate">{shopName(best.shopId)}</span>
                        <span className="font-medium">{formatUnitPrice(best.point.unit, p.measure)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="receipts" className="grid gap-3">
          {unmatchedTotal > 0 && (
            <button type="button" className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-left text-sm" onClick={() => setOnlyUnmatched(true)}>
              <Inbox className="size-4" /> {unmatchedTotal} unmatched line{unmatchedTotal === 1 ? "" : "s"} — the inbox. Open a receipt to match them to products.
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={onlyUnmatched ? "default" : "outline"} onClick={() => setOnlyUnmatched((v) => !v)} aria-pressed={onlyUnmatched}>
              <Inbox /> Unmatched
            </Button>
            <Button variant="outline" className="ml-auto" onClick={() => setNewReceipt(true)} disabled={shops.length === 0}>
              <Plus /> Receipt by hand
            </Button>
          </div>
          {receiptRows.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{receipts.length === 0 ? "No receipts yet — scan one." : "Nothing to show."}</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {receiptRows.map(({ r, ls, sum, mismatch, unmatched }) => (
                <li key={r.id}>
                  <button type="button" className="hover:bg-accent/50 flex w-full items-center gap-3 px-3 py-2 text-left text-sm" onClick={() => setOpenReceipt(r)}>
                    <span className="text-muted-foreground w-24 shrink-0 tabular-nums">{formatHuman(r.date)}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(r.shopId, shops) }} />
                      {shopName(r.shopId)}
                      {r.branch && <span className="text-muted-foreground truncate text-xs">· {r.branch}</span>}
                    </span>
                    {unmatched > 0 && (
                      <Badge variant="outline" className="border-amber-500/60 text-amber-600 dark:text-amber-500">
                        {unmatched} unmatched
                      </Badge>
                    )}
                    {mismatch && <TriangleAlert className="size-3.5 text-amber-600" aria-label="Printed total differs from the lines" />}
                    <span className="text-muted-foreground text-xs">{ls.length} line{ls.length === 1 ? "" : "s"}</span>
                    <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatCents(r.total > 0 ? r.total : sum)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="change" className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPANS.map((s) => (
                  <SelectItem key={s.months} value={String(s.months)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm">
              Across the basket: {overall.median === null ? <span className="text-muted-foreground">not enough points yet</span> : <Pct v={overall.median} />}
              <span className="text-muted-foreground text-xs"> · median of {overall.n} product-shop pair{overall.n === 1 ? "" : "s"}</span>
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Per shop, earliest to latest usual price in the span; promos left out. A product bought once at a shop says nothing.</p>
          {changeRows.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">Nothing bought twice at the same shop in this span.</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {changeRows.map(({ p, changes }) => (
                <li key={p.id} className="grid gap-1 px-3 py-2 text-sm">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => navigate(productHref(p.id))}>
                    {p.title}
                  </button>
                  {changes.map((c) => (
                    <div key={c.shopId} className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(c.shopId, shops) }} />
                      <span className="w-28 truncate">{shopName(c.shopId)}</span>
                      <span className="tabular-nums">
                        {formatUnitPrice(c.first.unit, p.measure)} → {formatUnitPrice(c.last.unit, p.measure)}
                      </span>
                      <Pct v={c.pct} />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="shops" className="grid gap-3">
          <div className="flex items-center">
            <Button variant="outline" className="ml-auto" onClick={() => setNewShop(true)}>
              <Plus /> Shop
            </Button>
          </div>
          {shops.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">A shop is a chain — Lidl, Biocoop — never a branch.</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {shops.map((s) => {
                const n = receipts.filter((r) => r.shopId === s.id).length;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: shopColor(s.id, shops) }} />
                    <span className="min-w-0 flex-1 truncate">
                      {s.title}
                      {s.note && <span className="text-muted-foreground text-xs"> · {s.note}</span>}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {n} receipt{n === 1 ? "" : "s"}
                    </span>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditShop(s)} title="Edit shop">
                      <Pencil className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ScanReceiptDialog open={scanOpen} onOpenChange={setScanOpen} />
      <AddPriceDialog open={priceOpen} onOpenChange={setPriceOpen} />
      <ReceiptDialog open={newReceipt} onOpenChange={setNewReceipt} />
      <ReceiptDialog open={!!openReceipt} onOpenChange={(o) => !o && setOpenReceipt(null)} receipt={openReceipt} />
      <ProductDialog open={newProduct} onOpenChange={setNewProduct} />
      <ShopDialog open={newShop} onOpenChange={setNewShop} />
      <ShopDialog open={!!editShop} onOpenChange={(o) => !o && setEditShop(null)} shop={editShop} />
    </div>
  );
}
