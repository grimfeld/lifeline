import { useMemo, useState } from "react";
import { Card, CardContent, Input, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { useSources } from "../data/works";
import { useQuotes } from "../data/quotes";
import { searchQuotes } from "../domain/quotes";
import type { Quote } from "../domain/types";
import { KNOWN_FAMILIES, familyLabel, type SourceItem } from "../domain/works";
import { Cover } from "../components/Cover";
import { newestFirst, QuoteBlock } from "../components/QuoteBlock";

import { cn } from "@lifeline/ui";

/** A family the shelf knows ("book", "podcast"…), or "all". */
export type Medium = string;

function TypeChips({ value, onChange, counts }: { value: Medium; onChange: (v: Medium) => void; counts: Map<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: "all", label: "All" }, ...familiesIn(counts).map((f) => ({ id: f, label: familyLabel(f, true) }))].map((t) => (
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

/** The families that have quotes, in the shelf's order (works, then the App's own kinds, then the rest). */
function familiesIn(counts: Map<string, number>): string[] {
  const order = KNOWN_FAMILIES.map((f) => f.value);
  const present = [...counts.keys()].filter((k) => k !== "all" && (counts.get(k) ?? 0) > 0);
  return present.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b));
}

type Sort = "newest" | "oldest" | "random";

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The Quotes screen (ADR 0024, ADR 0070): every quote, searchable and filterable, grouped by the Source it came from. */
export function CommonplaceScreen() {
  const items = useSources();
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
      const t = byId.get(x.source)?.family;
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
    m.set("all", quotes.length);
    return m;
  }, [quotes, byId]);
  const itemOptions = useMemo(() => {
    const withQuotes = new Set(quotes.map((x) => x.source));
    return items.filter((m) => withQuotes.has(m.id) && (type === "all" || m.family === type)).sort((a, b) => a.title.localeCompare(b.title));
  }, [items, quotes, type]);

  const filtered = useMemo(() => {
    let xs = searchQuotes(quotes, byId, q);
    if (type !== "all") xs = xs.filter((x) => byId.get(x.source)?.family === type);
    if (itemId !== "all") xs = xs.filter((x) => x.source === itemId);
    if (sort === "random") {
      for (const x of shuffled(xs)) if (!randomRank.has(x.id)) randomRank.set(x.id, randomRank.size);
      return [...xs].sort((a, b) => (randomRank.get(a.id) ?? 0) - (randomRank.get(b.id) ?? 0));
    }
    const newest = newestFirst(xs);
    return sort === "newest" ? newest : newest.reverse();
  }, [quotes, byId, q, type, itemId, sort, randomRank]);

  // Group by item in order of first appearance.
  const groups = useMemo(() => {
    const out: { item: SourceItem | undefined; id: string; quotes: Quote[] }[] = [];
    const idx = new Map<string, number>();
    for (const x of filtered) {
      let group = out[idx.get(x.source) ?? -1];
      if (!group) {
        idx.set(x.source, out.length);
        group = { item: byId.get(x.source), id: x.source, quotes: [] };
        out.push(group);
      }
      group.quotes.push(x);
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
        <PhoneDock>
          {/* Desk: the chips stay above the search (md:-order-1); phone: they and the selects go in the Filters sheet. */}
          <div className="flex flex-1 flex-wrap gap-2 max-md:contents">
            <Input className="flex-1 md:min-w-40 max-md:w-auto max-md:basis-36" placeholder="Search quotes, comments, titles, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
            <PhoneFilters active={+(type !== "all") + +(itemId !== "all") + +(sort !== "newest")}>
              <div className="w-full md:-order-1 md:mb-1">
                <TypeChips
                  value={type}
                  onChange={(t) => {
                    setType(t);
                    setItemId("all");
                  }}
                  counts={counts}
                />
              </div>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-48" aria-label="Source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every Source</SelectItem>
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
            </PhoneFilters>
          </div>
        </PhoneDock>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">{quotes.length === 0 ? "No quotes yet — keep one from any book, film, article or podcast." : "Nothing matches."}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.id} className="grid gap-2" aria-label={g.item?.title ?? "Unknown source"}>
              <header className="flex items-center gap-2">
                {g.item && <Cover item={g.item} className="h-10 w-7 text-[7px]" />}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.item?.title ?? "Unknown source"}</div>
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
