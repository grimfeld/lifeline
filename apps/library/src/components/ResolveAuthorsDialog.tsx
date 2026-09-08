import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { Sparkles } from "lucide-react";
import { isUnresolved, type AuthorHit } from "../domain/authors";
import type { Author } from "../domain/types";
import { useAuthors } from "../data/repo";
import { resolveAuthor, resolveAuthorsAll, type ResolveProgress, type ResolveResult } from "../data/authorActions";
import { authorHref } from "../constants";

type NeedsPick = ResolveResult["needsPick"][number];

/** One "needs a pick" row: the Author, a candidates select, Apply. */
function PickRow({ entry, onApplied }: { entry: NeedsPick; onApplied: () => void }) {
  const [key, setKey] = useState(entry.hits[0]?.externalKey ?? "");
  const [busy, setBusy] = useState(false);
  const hit = entry.hits.find((h) => h.externalKey === key);
  async function apply() {
    if (!hit) return;
    setBusy(true);
    try {
      await resolveAuthor(entry.author, hit);
      toast.success(`${entry.author.title} — resolved`);
      onApplied();
    } catch (e) {
      toast.error((e as Error).message || "Could not apply");
    } finally {
      setBusy(false);
    }
  }
  const label = (h: AuthorHit) => [h.name, [h.born, h.died].filter(Boolean).join("–"), h.topWork, h.workCount ? `${h.workCount} works` : ""].filter(Boolean).join(" · ");
  return (
    <li className="grid gap-1.5 rounded-md border p-2">
      <Link to={authorHref(entry.author.id)} className="truncate text-sm font-medium underline-offset-2 hover:underline">
        {entry.author.title}
      </Link>
      <div className="flex items-center gap-2">
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Candidates for ${entry.author.title}`}>
            <SelectValue placeholder="Pick a candidate…" />
          </SelectTrigger>
          <SelectContent>
            {entry.hits.map((h) => (
              <SelectItem key={h.externalKey} value={h.externalKey}>
                {label(h)}
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
 * "Resolve authors" (ADR 0052): walks the Authors with no Open Library
 * identity, applies only a single exact-name hit, and lists the rest for a
 * pick. Lives in the lookup settings dialog and behind a palette command.
 */
export function ResolveAuthorsSection({ open }: { open: boolean }) {
  const authors = useAuthors();
  const unresolved = authors.filter(isUnresolved);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [needsPick, setNeedsPick] = useState<NeedsPick[]>([]);
  const [notFound, setNotFound] = useState<Author[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  async function run() {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRunning(true);
    setNeedsPick([]);
    setNotFound([]);
    setProgress({ done: 0, total: unresolved.length, resolved: 0, failed: 0 });
    try {
      const res = await resolveAuthorsAll(authors, setProgress, ctl.signal);
      setNeedsPick(res.needsPick);
      setNotFound(res.notFound);
      if (!ctl.signal.aborted) toast.success(`Resolved ${res.resolved} of ${res.total}${res.needsPick.length ? ` — ${res.needsPick.length} need a pick` : ""}${res.notFound.length ? ` · ${res.notFound.length} not found` : ""}${res.failed ? ` · ${res.failed} failed` : ""}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="grid gap-2 border-t pt-3" aria-label="Resolve authors">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Resolve authors</h3>
          <p className="text-muted-foreground text-xs">
            {unresolved.length} author{unresolved.length === 1 ? "" : "s"} without an Open Library identity. A single exact-name match is applied; the rest are listed for a pick.
          </p>
        </div>
        {running ? (
          <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={unresolved.length === 0} onClick={() => void run()}>
            <Sparkles /> Resolve
          </Button>
        )}
      </div>
      {progress && (
        <p className="text-xs tabular-nums" aria-live="polite">
          {progress.done} / {progress.total} · {progress.resolved} resolved{progress.failed ? ` · ${progress.failed} failed` : ""}
          {running ? "…" : ""}
        </p>
      )}
      {needsPick.length > 0 && (
        <div className="grid gap-1.5">
          <h4 className="text-muted-foreground text-xs font-medium">Needs a pick · {needsPick.length}</h4>
          <ul className="grid gap-1.5">
            {needsPick.map((e) => (
              <PickRow key={e.author.id} entry={e} onApplied={() => setNeedsPick((l) => l.filter((x) => x.author.id !== e.author.id))} />
            ))}
          </ul>
        </div>
      )}
      {notFound.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Not on Open Library: {notFound.map((a) => a.title).join(", ")}.
        </p>
      )}
    </section>
  );
}

/** The palette's door to the same section. */
export function ResolveAuthorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve authors</DialogTitle>
        </DialogHeader>
        <ResolveAuthorsSection open={open} />
      </DialogContent>
    </Dialog>
  );
}
