import { useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { Author } from "../domain/types";
import { mergeAuthors, useAuthors } from "../data/repo";

/**
 * Merge (CONTEXT.md "Author"): this Author into another, or — "keep this
 * one" — the other into this. The resolved one is the sensible survivor, so
 * the box is pre-ticked when this Author is resolved and the other is not.
 */
export function MergeAuthorDialog({ author, onClose, onMerged }: { author: Author | null; onClose: () => void; onMerged: (survivorId: string) => void }) {
  const all = useAuthors();
  const others = useMemo(() => all.filter((a) => a.id !== author?.id).sort((a, b) => a.title.localeCompare(b.title)), [all, author]);
  const [otherId, setOtherId] = useState("");
  const other = others.find((a) => a.id === otherId);
  const [keepThis, setKeepThis] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  if (!author) return null;
  const keep = keepThis ?? (!!author.externalKey && !other?.externalKey);
  const survivor = keep ? author : other;
  const loser = keep ? other : author;

  async function run() {
    if (!survivor || !loser) return;
    setBusy(true);
    try {
      await mergeAuthors(survivor.id, loser.id);
      toast.success(`${loser.title} merged into ${survivor.title}`);
      onMerged(survivor.id);
    } catch (e) {
      toast.error((e as Error).message || "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {author.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Same person as</Label>
            <Select value={otherId} onValueChange={setOtherId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an author…" />
              </SelectTrigger>
              <SelectContent>
                {others.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                    {a.externalKey ? "" : " · unresolved"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {other && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={keep} onCheckedChange={(c) => setKeepThis(c === true)} /> Keep “{author.title}” (merge “{other.title}” into it)
              </label>
              <p className="text-muted-foreground text-xs">
                “{survivor?.title}” keeps its name and takes the other's works, names as aliases, notes, and identity where it had none. “{loser?.title}” is deleted. Links written as{" "}
                <code>[[{loser?.title}]]</code> keep resolving.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!other || busy} onClick={() => void run()}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
