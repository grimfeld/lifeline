import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { BookMarked, Plus, Quote as QuoteIcon, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { AddMediaDialog } from "./components/AddMediaDialog";
import { QuickAdd } from "./components/QuickAdd";
import { QuoteEditor } from "./components/QuoteEditor";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { defaultCaptureItem } from "./domain/cardQueries";
import { useMedia } from "./data/repo";
import { QUOTES_HREF } from "./constants";

/** "Add quote…": pick an item (in-progress first), then the inline editor; closes on save. */
function AddQuoteCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useMedia();
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
              <SelectTrigger aria-label="Item">
                <SelectValue placeholder="Pick an item…" />
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

function AddMediaCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddMediaDialog {...props} />;
}

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add media</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const mediaCommands: CommandDef[] = [
  { id: "media.quick-add", title: "Add media…", keywords: ["book", "movie", "series", "album", "game", "comic", "read", "watch", "quick"], icon: Plus, dialog: QuickAddCommandDialog },
  { id: "media.add", title: "Add media with details", keywords: ["book", "movie", "series", "album", "game", "comic", "read", "watch", "details"], icon: SlidersHorizontal, dialog: AddMediaCommandDialog },
  { id: "media.open", title: "Go to Media", keywords: ["media", "books", "reading", "nightstand", "shelf"], icon: BookMarked, run: ({ navigate }) => navigate("/app/media") },
  { id: "media.quote-add", title: "Add quote…", keywords: ["quote", "passage", "highlight", "book", "capture"], icon: QuoteIcon, dialog: AddQuoteCommandDialog },
  { id: "media.quotes", title: "Go to Quotes", keywords: ["quotes", "passages", "highlights", "media"], icon: QuoteIcon, run: ({ navigate }) => navigate(QUOTES_HREF) },
  { id: "media.lookup-settings", title: "Media lookup settings…", keywords: ["media", "lookup", "metadata", "api", "key", "tmdb", "rawg", "comicvine", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
