import { useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from "@lifeline/ui";
import { Check, Eye } from "lucide-react";
import { workType } from "../domain/workTypes";
import { finish } from "../domain/rules";
import { matchesSearch } from "../domain/browse";
import { patchWork, useWorks } from "../data/repo";
import { Cover } from "./Cover";
import { LikeToggle, StarRating } from "./Marks";

const LIMIT = 12;

/**
 * "Mark listened…" (ADR 0035), the phone-sheet one-click: type a few letters,
 * tap the album — it is Listened — then the stars and the heart right there,
 * before the sheet goes. Everything not yet Done is offered.
 */
export function MarkListenedDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useWorks();
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = pickedId ? (items.find((m) => m.id === pickedId) ?? null) : null;
  const candidates = useMemo(
    () =>
      items
        .filter((m) => m.engagement !== "DONE" && matchesSearch(m, q))
        .sort((a, b) => Number(b.engagement === "IN_PROGRESS") - Number(a.engagement === "IN_PROGRESS") || b.addedOn.localeCompare(a.addedOn))
        .slice(0, LIMIT),
    [items, q],
  );

  function close(o: boolean) {
    if (!o) {
      setQ("");
      setPickedId(null);
    }
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{picked ? `${workType(picked.type).engagement.DONE}.` : "Mark listened"}</DialogTitle>
        </DialogHeader>
        {picked ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <Cover item={picked} className="h-20 w-14 rounded border shadow" />
              <div className="min-w-0">
                <div className="truncate font-medium">{picked.title}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {picked.creator}
                  {picked.creator && picked.year ? " · " : ""}
                  {picked.year || ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StarRating item={picked} />
              <LikeToggle item={picked} size="md" className="text-muted-foreground hover:text-rose-400 [&[aria-pressed=true]]:text-rose-500" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPickedId(null)}>
                Another
              </Button>
              <Button size="sm" onClick={() => close(false)}>
                <Check /> Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Input autoFocus placeholder="Album, artist, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
            {candidates.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">{items.length === 0 ? "The Discotheque is empty." : "Nothing unheard matches."}</p>
            ) : (
              <ul className="grid max-h-80 gap-0.5 overflow-y-auto">
                {candidates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left"
                      onClick={() => {
                        void patchWork(m, finish());
                        setPickedId(m.id);
                      }}
                    >
                      <Cover item={m} className="h-10 w-7 rounded border" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{m.title}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {workType(m.type).label}
                          {m.year ? ` · ${m.year}` : ""}
                          {m.engagement === "IN_PROGRESS" ? ` · ${workType(m.type).engagement.IN_PROGRESS}` : ""}
                        </span>
                      </span>
                      <Eye className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
