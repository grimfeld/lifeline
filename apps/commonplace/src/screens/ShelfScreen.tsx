import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, PhoneDock, toast } from "@lifeline/ui";
import { useDocumentTypes } from "@lifeline/core";
import { Plus, NotebookPen } from "lucide-react";
import { useSources } from "../data/works";
import { useNotes } from "../data/notes";
import { useQuotes } from "../data/quotes";
import { addSource } from "../data/sources";
import { KNOWN_FAMILIES, familyLabel, type SourceItem } from "../domain/works";
import { SOURCE_KINDS, sourceHref, type SourceKind } from "../domain/types";
import { Cover } from "../components/Cover";
import { CaptureForm } from "../components/CaptureForm";

/** Families in the shelf's order: works first, then the App's own kinds, then whatever else wears the Role, by name. */
function orderFamilies(families: string[]): string[] {
  const order = KNOWN_FAMILIES.map((f) => f.value);
  return [...families].sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b));
}

function matches(s: SourceItem, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  if (n.startsWith("#")) return s.tags.includes(n.slice(1));
  return [s.title, s.creator, ...(s.tags ?? [])].some((x) => x.toLowerCase().includes(n));
}

/** New Source by name and kind — the rest is filled in on its page. */
function NewSourceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SourceKind>("article");
  const [url, setUrl] = useState("");
  async function save() {
    try {
      const s = await addSource({ title, kind, url });
      setTitle("");
      setUrl("");
      onOpenChange(false);
      navigate(sourceHref(s.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New source</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2" onKeyDown={(e) => e.key === "Enter" && title.trim() && void save()}>
          <Input autoFocus placeholder="Name" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Name" />
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Kind">
            {SOURCE_KINDS.map((k) => (
              <Button key={k.value} size="sm" variant={kind === k.value ? "secondary" : "ghost"} role="radio" aria-checked={kind === k.value} className="h-7" onClick={() => setKind(k.value)}>
                {k.label}
              </Button>
            ))}
          </div>
          <Input placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" />
          <p className="text-muted-foreground text-xs">Books, films and albums are Sources already — add them in Culture.</p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void save()} disabled={!title.trim()}>
              Add source
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Notes Module's shelf (ADR 0070): every Source by family — works, then
 * articles, podcasts, videos — each with what I took from it. A Source is
 * where Notes and Quotes start, so the shelf is the way in.
 */
export function ShelfScreen() {
  const sources = useSources();
  const notes = useNotes();
  const quotes = useQuotes();
  const types = useDocumentTypes();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const typeLabel = (id: string) => {
    const d = types.find((t) => t.id === id);
    return d ? d.label : undefined;
  };
  const counts = useMemo(() => {
    // A parent Source gathers its children's (CONTEXT.md "Source"): a show counts its episodes' Notes and Quotes.
    const parentOf = new Map(sources.filter((s) => s.parent).map((s) => [s.id, s.parent!]));
    const m = new Map<string, { notes: number; quotes: number }>();
    const add = (id: string, k: "notes" | "quotes") => {
      for (const at of [id, parentOf.get(id)]) {
        if (!at) continue;
        const c = m.get(at) ?? { notes: 0, quotes: 0 };
        c[k] += 1;
        m.set(at, c);
      }
    };
    for (const n of notes) add(n.source, "notes");
    for (const x of quotes) add(x.source, "quotes");
    return m;
  }, [notes, quotes, sources]);
  const shelves = useMemo(() => {
    const kept = sources.filter((s) => matches(s, q.trim()));
    const byFamily = new Map<string, SourceItem[]>();
    for (const s of kept) byFamily.set(s.family, [...(byFamily.get(s.family) ?? []), s]);
    // Within a shelf, the Sources I took most from lead, then by name.
    const weight = (s: SourceItem) => (counts.get(s.id)?.notes ?? 0) + (counts.get(s.id)?.quotes ?? 0);
    return orderFamilies([...byFamily.keys()]).map((f) => ({ family: f, items: byFamily.get(f)!.sort((a, b) => weight(b) - weight(a) || a.title.localeCompare(b.title)) }));
  }, [sources, q, counts]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <span className="text-muted-foreground text-sm tabular-nums max-md:hidden">
          {sources.length} sources · {notes.length} notes · {quotes.length} quotes
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setCapturing(true)}>
          <NotebookPen /> Note or quote…
        </Button>
      </div>
      <PhoneDock>
        <div className="flex items-center gap-2 max-md:contents">
          <Input className="min-w-0 flex-1" placeholder="Find a Source — title, author, #tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a Source" />
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> New source
          </Button>
        </div>
      </PhoneDock>
      {shelves.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{sources.length === 0 ? "No Sources yet — add an article or a podcast, or a book in Culture." : "No Source matches."}</p>
      ) : (
        shelves.map((shelf) => (
          <section key={shelf.family} className="grid gap-2" aria-label={familyLabel(shelf.family, true, typeLabel)}>
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {familyLabel(shelf.family, true, typeLabel)} <span className="tabular-nums opacity-70">{shelf.items.length}</span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
              {shelf.items.map((s) => {
                const c = counts.get(s.id);
                return (
                  <Link key={s.id} to={sourceHref(s.id)} className="bg-card hover:bg-accent/40 flex min-w-0 items-center gap-3 rounded-lg border p-2 transition-colors">
                    <Cover item={s} className="h-12 w-9 text-[7px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.title}</div>
                      {s.creator && <div className="text-muted-foreground truncate text-xs">{s.creator}</div>}
                      <div className="text-muted-foreground truncate text-xs tabular-nums">
                        {c ? [c.notes && `${c.notes} ${c.notes === 1 ? "note" : "notes"}`, c.quotes && `${c.quotes} ${c.quotes === 1 ? "quote" : "quotes"}`].filter(Boolean).join(" · ") : "nothing taken yet"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
      <NewSourceDialog open={adding} onOpenChange={setAdding} />
      <Dialog open={capturing} onOpenChange={setCapturing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Note or quote</DialogTitle>
          </DialogHeader>
          <CaptureForm autoFocus onDone={() => setCapturing(false)} onCancel={() => setCapturing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

