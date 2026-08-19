import { useEffect, useMemo, useState } from "react";
import type { CardProps } from "@lifeline/core";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, toast } from "@lifeline/ui";
import { useMedia } from "../data/repo";
import { addQuote } from "../data/quotes";
import { byMedium, defaultCaptureItem } from "../domain/cardQueries";
import { mediumOf } from "./shared";

/** Card: jot a quote into a chosen item — Enter / ⌘Enter or Save. */
export function QuoteCaptureCard({ settings }: CardProps) {
  const medium = mediumOf(settings);
  const items = useMedia();
  const ofMedium = useMemo(() => [...byMedium(items, medium)].sort((a, b) => a.title.localeCompare(b.title)), [items, medium]);
  const [itemId, setItemId] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (!itemId || !ofMedium.some((m) => m.id === itemId)) setItemId(defaultCaptureItem(ofMedium, medium)?.id ?? "");
  }, [ofMedium, medium, itemId]);

  async function save() {
    if (!text.trim()) return;
    if (!itemId) return void toast.error("Pick an item first");
    await addQuote({ mediaId: itemId, text });
    toast.success("Quote saved");
    setText("");
  }

  if (ofMedium.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing to quote from yet.</div>;
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
            {ofMedium.map((m) => (
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
