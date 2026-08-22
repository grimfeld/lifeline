import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { Sparkles } from "lucide-react";
import { useWorks } from "../data/repo";
import { applyPick, enrichable, enrichAll, type EnrichProgress, type NeedsPick } from "../data/enrichActions";
import { Cover } from "./Cover";

/** One "needs a pick" row of Enrich all: the item, a candidates select, Apply. */
function PickRow({ entry, onApplied }: { entry: NeedsPick; onApplied: () => void }) {
  const [key, setKey] = useState(entry.hits[0]?.externalKey ?? "");
  const [busy, setBusy] = useState(false);
  const hit = entry.hits.find((h) => h.externalKey === key);
  async function apply() {
    if (!hit) return;
    setBusy(true);
    try {
      await applyPick(entry.item, hit);
      toast.success(`${entry.item.title} — filled`);
      onApplied();
    } catch (e) {
      toast.error((e as Error).message || "Could not apply");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="grid gap-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Cover item={entry.item} className="size-10 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{entry.item.title}</span>
          <span className="text-muted-foreground block truncate text-xs">{[entry.item.creator, entry.item.year || ""].filter(Boolean).join(" · ") || "—"}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Candidates for ${entry.item.title}`}>
            <SelectValue placeholder="Pick a candidate…" />
          </SelectTrigger>
          <SelectContent>
            {entry.hits.map((h) => (
              <SelectItem key={h.externalKey} value={h.externalKey}>
                {[h.title, h.creator, h.year || ""].filter(Boolean).join(" · ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!hit || busy} onClick={() => void apply()}>
          Apply
        </Button>
      </div>
    </li>
  );
}

/**
 * "Enrich all" for the Discotheque — MusicBrainz is keyless, so this dialog
 * has no keys to manage: it walks albums without an external key or cover,
 * auto-applies confident matches, and lists the rest for a manual pick.
 */
export function EnrichDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useWorks();
  const [progress, setProgress] = useState<EnrichProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [needsPick, setNeedsPick] = useState<NeedsPick[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const candidates = enrichable(items, {});

  async function runEnrich() {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRunning(true);
    setNeedsPick([]);
    setProgress({ done: 0, total: candidates.length, applied: 0, failed: 0 });
    try {
      const res = await enrichAll(items, {}, setProgress, ctl.signal);
      setNeedsPick(res.needsPick);
      if (!ctl.signal.aborted) toast.success(`Enriched ${res.applied} of ${res.total}${res.needsPick.length ? ` — ${res.needsPick.length} need a pick` : ""}${res.failed ? ` · ${res.failed} failed` : ""}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enrich from MusicBrainz</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {candidates.length} album{candidates.length === 1 ? "" : "s"} without an external key or cover. Exact title matches are applied; the rest are listed for a pick. One request per second (MusicBrainz policy).
            </p>
            {running ? (
              <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={candidates.length === 0} onClick={() => void runEnrich()}>
                <Sparkles /> Enrich all
              </Button>
            )}
          </div>
          {progress && (
            <p className="text-xs tabular-nums" aria-live="polite">
              {progress.done} / {progress.total} · {progress.applied} applied{progress.failed ? ` · ${progress.failed} failed` : ""}
              {running ? "…" : ""}
            </p>
          )}
          {needsPick.length > 0 && (
            <div className="grid gap-1.5">
              <h4 className="text-muted-foreground text-xs font-medium">Needs a pick · {needsPick.length}</h4>
              <ul className="grid gap-1.5">
                {needsPick.map((e) => (
                  <PickRow key={e.item.id} entry={e} onApplied={() => setNeedsPick((l) => l.filter((x) => x.item.id !== e.item.id))} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
