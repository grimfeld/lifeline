import { useEffect, useMemo, useState } from "react";
import type { CardProps } from "@lifeline/core";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, toast } from "@lifeline/ui";
import { useQuotedWorks } from "../data/works";
import { addQuote } from "../data/quotes";
import { byType, defaultCaptureItem } from "../domain/works";
import { familyOf } from "./quoteShared";

/** Card: jot a quote into a chosen item — Enter / ⌘Enter or Save. */
export function QuoteCaptureCard({ settings }: CardProps) {
  const family = familyOf(settings);
  const items = useQuotedWorks();
  const ofFamily = useMemo(() => [...byType(items, family)].sort((a, b) => a.title.localeCompare(b.title)), [items, family]);
  const [itemId, setItemId] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (!itemId || !ofFamily.some((m) => m.id === itemId)) setItemId(defaultCaptureItem(ofFamily, family)?.id ?? "");
  }, [ofFamily, family, itemId]);

  async function save() {
    if (!text.trim()) return;
    if (!itemId) return void toast.error("Pick an item first");
    await addQuote({ mediaId: itemId, text });
    toast.success("Quote saved");
    setText("");
  }

  if (ofFamily.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing to quote from yet.</div>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <Textarea
        className="min-h-0 flex-1 resize-none text-sm"
        placeholder="Quote…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
        aria-label="Quote"
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label="Item">
            <SelectValue placeholder="Item…" />
          </SelectTrigger>
          <SelectContent>
            {ofFamily.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void save()} disabled={!text.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
