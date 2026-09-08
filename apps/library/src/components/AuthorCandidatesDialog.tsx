import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import type { AuthorHit } from "../domain/authors";
import type { Author } from "../domain/types";
import { findAuthorCandidates, resolveAuthor } from "../data/authorActions";

/** One Open Library author candidate: name, years, top work, work count — what tells two John Williamses apart. */
export function AuthorHitRow({ hit, onPick, disabled }: { hit: AuthorHit; onPick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} className="hover:bg-accent grid w-full gap-0.5 rounded-md border p-2 text-left disabled:opacity-50" onClick={onPick}>
      <span className="block truncate text-sm font-medium">{hit.name}</span>
      <span className="text-muted-foreground block truncate text-xs">
        {[[hit.born, hit.died].filter(Boolean).join(" – "), hit.topWork ? `“${hit.topWork}”` : "", hit.workCount ? `${hit.workCount} works` : ""].filter(Boolean).join(" · ") || "No details"}
      </span>
    </button>
  );
}

/**
 * "Find metadata" for an Author (ADR 0052): Open Library's candidates for the
 * name; a pick gives the Author its identity, years, photo and aliases —
 * never a new name.
 */
export function AuthorCandidatesDialog({ author, onClose }: { author: Author | null; onClose: () => void }) {
  const [hits, setHits] = useState<AuthorHit[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!author) return;
    setHits(null);
    setError("");
    const ctl = new AbortController();
    findAuthorCandidates(author, ctl.signal)
      .then(setHits)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message || "Lookup failed");
      });
    return () => ctl.abort();
  }, [author]);

  if (!author) return null;

  async function pick(h: AuthorHit) {
    if (!author) return;
    setBusy(true);
    try {
      await resolveAuthor(author, h);
      toast.success(`${author.title} — resolved to Open Library`);
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
          <DialogTitle>Find {author.title} on Open Library</DialogTitle>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!error && hits === null && <p className="text-muted-foreground text-sm">Searching…</p>}
        {hits && hits.length === 0 && <p className="text-muted-foreground text-sm">No candidates found.</p>}
        {hits && hits.length > 0 && (
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {hits.map((h) => (
              <li key={h.externalKey}>
                <AuthorHitRow hit={h} disabled={busy} onPick={() => void pick(h)} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
