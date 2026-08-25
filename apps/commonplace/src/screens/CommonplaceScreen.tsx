import { useMemo, useState } from "react";
import { Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { useQuotedWorks } from "../data/works";
import { useQuotes } from "../data/quotes";
import { searchQuotes } from "../domain/quotes";
import type { Quote } from "../domain/types";
import { WORK_LABELS, WORK_TYPE_IDS, type QuotedWork } from "../domain/works";
import { Cover } from "../components/Cover";
import { newestFirst, QuoteBlock } from "../components/QuoteBlock";

import { cn } from "@lifeline/ui";

export type Medium = (typeof WORK_TYPE_IDS)[number] | "all";

function TypeChips({ value, onChange, counts }: { value: Medium; onChange: (v: Medium) => void; counts: Map<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: "all" as const, label: "All" }, ...WORK_TYPE_IDS.map((t) => ({ id: t, label: WORK_LABELS[t].plural }))].map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", value === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {counts.get(t.id) ? <span className="ml-1 opacity-70">{counts.get(t.id)}</span> : null}
        </button>
      ))}
    </div>
  );
}

type Sort = "newest" | "oldest" | "random";

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The Quotes screen (ADR 0024): every quote, searchable and filterable, grouped by the work it came from. */
export function CommonplaceScreen() {
  const items = useQuotedWorks();
  const quotes = useQuotes();
  const [q, setQ] = useState("");
  const [type, setType] = useState<Medium>("all");
  const [itemId, setItemId] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  // Random = shuffle once per mount; a stable rank per id keeps live refreshes from reshuffling.
  const [randomRank] = useState(() => new Map<string, number>());
  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of quotes) {
      const t = byId.get(x.mediaId)?.type;
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
    m.set("all", quotes.length);
    return m;
  }, [quotes, byId]);
  const itemOptions = useMemo(() => {
    const withQuotes = new Set(quotes.map((x) => x.mediaId));
    return items.filter((m) => withQuotes.has(m.id) && (type === "all" || m.type === type)).sort((a, b) => a.title.localeCompare(b.title));
  }, [items, quotes, type]);

  const filtered = useMemo(() => {
    let xs = searchQuotes(quotes, byId, q);
    if (type !== "all") xs = xs.filter((x) => byId.get(x.mediaId)?.type === type);
    if (itemId !== "all") xs = xs.filter((x) => x.mediaId === itemId);
    if (sort === "random") {
      for (const x of shuffled(xs)) if (!randomRank.has(x.id)) randomRank.set(x.id, randomRank.size);
      return [...xs].sort((a, b) => (randomRank.get(a.id) ?? 0) - (randomRank.get(b.id) ?? 0));
    }
    const newest = newestFirst(xs);
    return sort === "newest" ? newest : newest.reverse();
  }, [quotes, byId, q, type, itemId, sort, randomRank]);

  // Group by item in order of first appearance.
  const groups = useMemo(() => {
    const out: { item: QuotedWork | undefined; id: string; quotes: Quote[] }[] = [];
    const idx = new Map<string, number>();
    for (const x of filtered) {
      let i = idx.get(x.mediaId);
      if (i === undefined) {
        i = out.length;
        idx.set(x.mediaId, i);
        out.push({ item: byId.get(x.mediaId), id: x.mediaId, quotes: [] });
      }
      out[i].quotes.push(x);
    }
    return out;
  }, [filtered, byId]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Quotes · <span className="tabular-nums">{quotes.length}</span>
          </h1>
        </div>
        <TypeChips
          value={type}
          onChange={(t) => {
            setType(t);
            setItemId("all");
          }}
          counts={counts}
        />
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" placeholder="Search quotes, comments, titles, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger className="w-48" aria-label="Item">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              {itemOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-32" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="random">Random</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">{quotes.length === 0 ? "No quotes yet — add one from any book, film, album or game." : "Nothing matches."}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.id} className="grid gap-2" aria-label={g.item?.title ?? "Unknown item"}>
              <header className="flex items-center gap-2">
                {g.item && <Cover item={g.item} className="h-10 w-7 text-[7px]" />}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.item?.title ?? "Unknown item"}</div>
                  {g.item?.creator && <div className="text-muted-foreground truncate text-xs">{g.item.creator}</div>}
                </div>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">{g.quotes.length}</span>
              </header>
              <div className="grid gap-2 pl-1">
                {g.quotes.map((x) => (
                  <QuoteBlock key={x.id} quote={x} item={g.item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
