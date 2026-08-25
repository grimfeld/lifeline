import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { NotebookPen, Quote as QuoteIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QuoteEditor } from "./components/QuoteEditor";
import { useQuotedWorks } from "./data/works";
import { defaultCaptureItem } from "./domain/works";
import { APP_HREF } from "./constants";

/** "Add quote…": pick a work (in-progress first), then the inline editor; closes on save. */
function AddQuoteCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useQuotedWorks();
  const sorted = useMemo(() => [...items].sort((a, b) => a.title.localeCompare(b.title)), [items]);
  const [itemId, setItemId] = useState("");
  useEffect(() => {
    if (open && (!itemId || !items.some((m) => m.id === itemId))) setItemId(defaultCaptureItem(items)?.id ?? "");
  }, [open, items, itemId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add quote</DialogTitle>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to quote from yet — add a book, film or album first.</p>
        ) : (
          <div className="grid gap-3">
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger aria-label="Work">
                <SelectValue placeholder="Pick a work…" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                    {m.creator ? ` — ${m.creator}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {itemId && <QuoteEditor key={itemId} mediaId={itemId} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const commonplaceCommands: CommandDef[] = [
  { id: "commonplace.quote-add", title: "Add quote…", keywords: ["quote", "passage", "highlight", "book", "film", "album", "capture", "commonplace"], icon: QuoteIcon, dialog: AddQuoteCommandDialog, capture: true },
  { id: "commonplace.open", title: "Go to Quotes", keywords: ["quotes", "passages", "highlights", "commonplace"], icon: NotebookPen, run: ({ navigate }) => navigate(APP_HREF) },
];
