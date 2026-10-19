import { useState } from "react";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { Button, Input, TagInput, Textarea, toast } from "@lifeline/ui";
import { addQuote, updateQuote } from "../data/quotes";
import type { Quote } from "../domain/types";

/**
 * Inline quote form, shared by "add" (give `source`, the Source's id) and "edit" (give `quote`).
 * Saves straight to the repo; ⌘/Ctrl+Enter saves, Escape cancels.
 */
export function QuoteEditor({ source, quote, onDone, onCancel, autoFocus = true }: { source: string; quote?: Quote; onDone?: (q: Quote) => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState(quote?.body ?? "");
  const [locator, setLocator] = useState(quote?.locator ?? "");
  const [comment, setComment] = useState(quote?.comment ?? "");
  const [tags, setTags] = useState<string[]>(quote?.tags ?? []);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  async function save() {
    if (!text.trim()) return void toast.error("Quote text required");
    if (quote) {
      const next = { ...quote, text, locator: locator.trim(), comment: comment.trim(), tags };
      await updateQuote(next);
      toast.success("Quote updated");
      onDone?.(next);
    } else {
      const q = await addQuote({ source, text, locator, comment, tags });
      toast.success("Quote saved");
      setText("");
      setLocator("");
      setComment("");
      setTags([]);
      onDone?.(q);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="grid gap-2" onKeyDown={onKeyDown}>
      <Textarea rows={3} autoFocus={autoFocus} placeholder="Quote…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Quote" />
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <Input placeholder="Page / chapter / time" value={locator} onChange={(e) => setLocator(e.target.value)} aria-label="Locator" />
        <Input placeholder="Your comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
      </div>
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={() => void save()}>
          {quote ? "Save" : "Add quote"}
        </Button>
      </div>
    </div>
  );
}
