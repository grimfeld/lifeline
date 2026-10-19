import { useMemo, useState } from "react";
import { Button, Input, Textarea, cn, toast } from "@lifeline/ui";
import { NotebookPen, Quote as QuoteIcon } from "lucide-react";
import { useSources } from "../data/works";
import { useNotes, addNote } from "../data/notes";
import { useQuotes, addQuote } from "../data/quotes";
import { addSource } from "../data/sources";
import { currentSources, type SourceItem } from "../domain/works";
import { lastUsedBySource } from "../domain/notes";
import { SourcePicker, NEW_SOURCE, emptyChoice, type SourceChoice } from "./SourcePicker";

export type CaptureMode = "note" | "quote";

/** Every Source, and the ones I'm in now first (ADR 0070's capture order). */
export function useCaptureSources(): { all: SourceItem[]; current: SourceItem[] } {
  const all = useSources();
  const notes = useNotes();
  const quotes = useQuotes();
  return useMemo(() => {
    const used = lastUsedBySource([...notes, ...quotes]);
    return { all, current: currentSources(all, used) };
  }, [all, notes, quotes]);
}

/** The picked Source's id — making the new one first when that is what was picked. */
export async function resolveChoice(choice: SourceChoice): Promise<string> {
  if (choice.id && choice.id !== NEW_SOURCE) return choice.id;
  if (!choice.newTitle.trim()) throw new Error("Pick a Source, or name a new one");
  return (await addSource({ title: choice.newTitle, kind: choice.newKind })).id;
}

/**
 * Take something from a Source (ADR 0070): a Note (my words) or a Quote (its
 * words), with where in the Source. `source` fixes the Source — the Source
 * page's own form — otherwise the picker offers the ones I'm in now first.
 */
export function CaptureForm({ source, defaultSource, initialMode = "note", autoFocus, onDone, onCancel }: { source?: string; defaultSource?: string; initialMode?: CaptureMode; autoFocus?: boolean; onDone?: (id: string) => void; onCancel?: () => void }) {
  const { all, current } = useCaptureSources();
  const [choice, setChoice] = useState<SourceChoice>(() => ({ ...emptyChoice, id: source ?? "" }));
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [text, setText] = useState("");
  const [locator, setLocator] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  // Until the user picks, the picker shows the Source I'm most likely in.
  const shown: SourceChoice = choice.id || choice.newTitle ? choice : { ...emptyChoice, id: defaultSource ?? current[0]?.id ?? "" };

  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const sourceId = await resolveChoice(shown);
      const made = mode === "note" ? await addNote({ source: sourceId, text, locator }) : await addQuote({ source: sourceId, text, locator, comment });
      toast.success(mode === "note" ? `Noted “${made.title}”` : "Quote kept");
      setText("");
      setLocator("");
      setComment("");
      if (!source) setChoice({ ...emptyChoice, id: sourceId });
      onDone?.(made.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="grid gap-2"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void save();
        } else if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {!source && <SourcePicker current={current} all={all} value={shown} onChange={setChoice} />}
      <div className="flex gap-1" role="radiogroup" aria-label="Note or quote">
        {(["note", "quote"] as const).map((m) => (
          <Button key={m} type="button" size="sm" variant={mode === m ? "secondary" : "ghost"} role="radio" aria-checked={mode === m} className={cn("h-7 flex-1", mode !== m && "text-muted-foreground")} onClick={() => setMode(m)}>
            {m === "note" ? <NotebookPen /> : <QuoteIcon />} {m === "note" ? "Note — my words" : "Quote — its words"}
          </Button>
        ))}
      </div>
      <Textarea
        autoFocus={autoFocus}
        rows={4}
        className={cn("min-h-24 resize-y", mode === "quote" && "font-serif italic")}
        placeholder={mode === "note" ? "What struck you…" : "The passage, word for word…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={mode === "note" ? "Note" : "Quote"}
      />
      <div className={cn("grid gap-2", mode === "quote" && "sm:grid-cols-[10rem_1fr]")}>
        <Input placeholder="Where — page, chapter, 34:12" value={locator} onChange={(e) => setLocator(e.target.value)} aria-label="Where" className="min-w-0" />
        {mode === "quote" && <Input placeholder="Your comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" className="min-w-0" />}
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground mr-auto text-xs max-md:hidden">⌘/Ctrl + Enter to keep</span>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={() => void save()} disabled={!text.trim() || busy}>
          {mode === "note" ? "Keep note" : "Keep quote"}
        </Button>
      </div>
    </div>
  );
}
