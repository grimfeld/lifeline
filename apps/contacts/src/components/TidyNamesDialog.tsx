import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { applyTidy } from "../data/repo";
import type { TidyRow } from "../domain/givenNames";
import { message } from "./writes";

/**
 * The one-off tidy-up of given-name aliases (ADR 0117): People whose title begins
 * with one of their own aliases and who have no Given name. Each row proposes the
 * Given name, the Family name and the alias to drop; untick the ones to leave. Offered
 * from the People home while any candidate exists; nothing changes until Apply.
 */
export function TidyNamesDialog({ open, onOpenChange, rows }: { open: boolean; onOpenChange: (open: boolean) => void; rows: readonly TidyRow[] }) {
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSkipped(new Set());
      setError("");
    }
  }, [open]);

  const chosen = rows.filter((r) => !skipped.has(r.id));

  async function apply() {
    setBusy(true);
    try {
      const n = await applyTidy(chosen.map((r) => r.id));
      toast.success(n === 1 ? "Tidied 1 person" : `Tidied ${n} people`);
      onOpenChange(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tidy given names</DialogTitle>
          <DialogDescription>These people's names start with one of their aliases. Fill in their Given and Family names and drop that alias; links to it keep working through the Given name. Untick anyone to leave as they are.</DialogDescription>
        </DialogHeader>
        {/* At most 60% of the screen's height: a long list scrolls inside, so the title and the buttons stay in view. */}
        <ul className="grid max-h-[60vh] min-w-0 gap-2 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}>
              <label className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5">
                <Checkbox
                  className="mt-1"
                  checked={!skipped.has(r.id)}
                  onCheckedChange={(c) =>
                    setSkipped((s) => {
                      const next = new Set(s);
                      if (c === true) next.delete(r.id);
                      else next.add(r.id);
                      return next;
                    })
                  }
                  aria-label={`Tidy ${r.title}: Given name ${r.givenName}, Family name ${r.familyName || "none"}, drops alias ${r.drop.join(", ")}`}
                />
                <span className="grid min-w-0 gap-0.5 text-sm">
                  <span className="min-w-0 truncate font-medium">{r.title}</span>
                  <span className="text-muted-foreground min-w-0 break-words">
                    Given name {r.givenName} · Family name {r.familyName || "none"} · drops alias {r.drop.join(", ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || chosen.length === 0} onClick={() => void apply()}>
            Apply to {chosen.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
