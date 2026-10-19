import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from "@lifeline/ui";
import type { IntakeDialogProps } from "@lifeline/core";
import { addQuote } from "../data/quotes";
import { addSource, nameFromUrl } from "../data/sources";
import { sourceHref } from "../domain/types";
import { SourcePicker, NEW_SOURCE, emptyChoice, type SourceChoice } from "./SourcePicker";
import { useCaptureSources } from "./CaptureForm";

/**
 * Intake (ADR 0050, ADR 0070): a text handed over from another App — a
 * selected passage — becomes a Quote, reviewed first. Its Source is made from what came
 * with it (title, link, author, date) unless I pick one I already have.
 * Nothing is written until Keep.
 */
export function QuoteIntakeDialog({ open, onOpenChange, handoff, onSaved }: IntakeDialogProps) {
  const navigate = useNavigate();
  const { all, current } = useCaptureSources();
  const [choice, setChoice] = useState<SourceChoice>({ ...emptyChoice, id: NEW_SOURCE });
  const [url, setUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(handoff.title);
    setText(handoff.text);
    setUrl(handoff.url ?? "");
    setAuthor(handoff.author ?? "");
    setChoice({ id: NEW_SOURCE, newTitle: handoff.title || (handoff.url ? nameFromUrl(handoff.url) : handoff.author ?? ""), newKind: handoff.url ? "article" : "other" });
  }, [open, handoff]);
  const making = choice.id === NEW_SOURCE;

  async function keep(openAfter: boolean) {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const sourceId = making
        ? (await addSource({ title: choice.newTitle || title || "Kept text", kind: choice.newKind, url, author, publishedOn: handoff.date?.slice(0, 10) })).id
        : choice.id;
      if (!sourceId) throw new Error("Pick a Source, or name a new one");
      const quote = await addQuote({ source: sourceId, text, title });
      toast.success("Kept as a Quote");
      onSaved?.(quote.id);
      onOpenChange(false);
      if (openAfter) navigate(sourceHref(sourceId));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keep as a Quote</DialogTitle>
          <DialogDescription>Trim the text if you like, then keep it with its Source. Nothing goes back to where it came from.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label className="text-xs">Source</Label>
          <SourcePicker current={current} all={all} value={choice} onChange={setChoice} id="intake-source" />
          {making && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Link" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link" className="min-w-0" />
              <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="Author" className="min-w-0" />
            </div>
          )}
          <Label htmlFor="intake-title" className="text-xs">
            Headline
          </Label>
          <Input id="intake-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional — the opening words otherwise" />
          <Textarea className="max-h-[40vh] min-h-40 font-serif" value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void keep(true)} disabled={busy || !text.trim()}>
            Keep and open
          </Button>
          <Button onClick={() => void keep(false)} disabled={busy || !text.trim()}>
            Keep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
