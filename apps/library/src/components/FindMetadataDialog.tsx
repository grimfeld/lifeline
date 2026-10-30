import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { hitByline, type WorkHit } from "../data/openlibrary";
import { describeLookup } from "../data/lookup";
import { applyPick, findCandidates } from "../data/enrichActions";
import { useLookupSettings } from "../data/repo";
import { Cover } from "./Cover";
import { BarcodeScan } from "./BarcodeScan";

/** One candidate row: cover, title, creator · year · size. */
export function HitRow({ hit, type, onPick, disabled }: { hit: WorkHit; type: Work["type"]; onPick: () => void; disabled?: boolean }) {
  const def = workType(type);
  return (
    <button type="button" disabled={disabled} className="hover:bg-accent flex w-full items-center gap-3 rounded-md border p-2 text-left disabled:opacity-50" onClick={onPick}>
      <Cover item={{ title: hit.title, coverUrl: hit.coverUrl, type }} className="h-12 w-8 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{hit.title}</span>
        <span className="text-muted-foreground block truncate text-xs">{[hitByline(hit), hit.year || "", hit.size ? `${hit.size} ${def.sizeUnit}` : ""].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}

/**
 * "Find metadata": candidates for one item from its medium's providers; a
 * pick fills the item's empty fields (never overwrites typed values). The
 * search starts from the title and can be changed: an ISBN typed or scanned
 * there runs the ISBN search (ADR 0108).
 */
export function FindMetadataDialog({ item, onClose }: { item: Work | null; onClose: () => void }) {
  const settings = useLookupSettings();
  const [hits, setHits] = useState<WorkHit[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** What is being searched: the title until another search (an ISBN) is typed or scanned. */
  const [query, setQuery] = useState(item?.title ?? "");
  const [typed, setTyped] = useState(query);

  useEffect(() => {
    if (!item) return;
    setHits(null);
    setError("");
    const ctl = new AbortController();
    findCandidates(item, settings, ctl.signal, query)
      .then(setHits)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message || "Lookup failed");
      });
    return () => ctl.abort();
  }, [item, settings, query]);

  if (!item) return null;

  async function pick(h: WorkHit) {
    if (!item) return;
    setBusy(true);
    try {
      const patch = await applyPick(item, h);
      const n = Object.keys(patch).length;
      toast.success(n ? `Filled ${n} field${n === 1 ? "" : "s"} from ${h.externalKey.split(":")[0]}` : "Nothing to fill — all fields already set");
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Could not apply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find metadata</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-w-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(typed.trim() || item.title);
          }}
        >
          <Input aria-label="Search" className="min-w-0 flex-1" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="A title or an ISBN" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">{describeLookup(item.type, settings)}</p>
        <BarcodeScan
          onIsbn={(isbn) => {
            setTyped(isbn);
            setQuery(isbn);
          }}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!error && hits === null && <p className="text-muted-foreground text-sm">Searching…</p>}
        {hits && hits.length === 0 && <p className="text-muted-foreground text-sm">No candidates found.</p>}
        {hits && hits.length > 0 && (
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {hits.map((h) => (
              <li key={h.externalKey}>
                <HitRow hit={h} type={item.type} disabled={busy} onPick={() => void pick(h)} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
