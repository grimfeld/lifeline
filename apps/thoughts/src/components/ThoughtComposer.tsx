import { useState } from "react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, toast } from "@lifeline/ui";
import { initialText } from "@lifeline/core";
import { Lightbulb } from "lucide-react";
import { captureThought } from "../data/repo";
import { THOUGHT_KINDS, isKind } from "../domain/types";

const NO_KIND = "__none__";

/**
 * Capture first (ADR 0068): one box, an optional kind, kept on ⌘/Ctrl+Enter.
 * The title is the first line, so there is nothing else to fill in.
 */
/** `initial` is the palette's inline line (CommandDialogProps.initial): the text and kind it understood. */
export function ThoughtComposer({ autoFocus, onKept, initial }: { autoFocus?: boolean; onKept?: () => void; initial?: Record<string, unknown> }) {
  const [text, setText] = useState(initialText(initial, "text"));
  const [kind, setKind] = useState<string>(isKind(initial?.kind) ? initial.kind : NO_KIND);
  const [busy, setBusy] = useState(false);

  async function keep() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await captureThought({ text, kind: isKind(kind) ? kind : undefined });
      setText("");
      onKept?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void keep();
          }
        }}
        placeholder="What's on your mind?"
        aria-label="New thought"
        className="min-h-24 resize-y"
        autoFocus={autoFocus}
      />
      <div className="flex items-center gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-8 w-40 min-w-0" aria-label="Kind">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_KIND}>No kind</SelectItem>
            {THOUGHT_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs max-md:hidden">⌘/Ctrl + Enter to keep</span>
        <Button size="sm" className="shrink-0" onClick={() => void keep()} disabled={!text.trim() || busy}>
          <Lightbulb /> Keep
        </Button>
      </div>
    </div>
  );
}
