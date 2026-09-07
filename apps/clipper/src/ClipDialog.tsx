import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from "@lifeline/ui";
import { docHref, type DateStr, type Handoff } from "@lifeline/core";
import { clip } from "./data";

/**
 * Paste → Clipping: title (optional), source, author, the text. Nothing is
 * fetched. With a `handoff` (ADR 0050: another App handing over a text with
 * its origin — a kept mail) the form opens prefilled and the text is reviewed
 * here before anything is saved.
 */
export function ClipDialog({ open, onOpenChange, handoff }: { open: boolean; onOpenChange: (o: boolean) => void; handoff?: Handoff }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !handoff) return;
    setTitle(handoff.title);
    setSource(handoff.url ?? "");
    setAuthor(handoff.author ?? "");
    setText(handoff.text);
  }, [open, handoff]);
  const publishedAt = (handoff?.date?.slice(0, 10) || undefined) as DateStr | undefined;
  async function submit(openAfter: boolean) {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await clip({ title, source, author, text, publishedAt });
      toast.success(`Clipped “${c.title}”`);
      setTitle("");
      setSource("");
      setAuthor("");
      setText("");
      onOpenChange(false);
      if (openAfter) navigate(docHref(c));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{handoff ? "Keep as Clipping" : "Clip"}</DialogTitle>
          <DialogDescription>
            {handoff ? "Trim the text if you like, then keep it. The Clipping is yours; nothing goes back to where it came from." : "Paste the text you want to keep and say where it came from. Lifeline never fetches pages."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label htmlFor="clip-source" className="text-xs">
              Source (URL or name)
            </Label>
            <Input id="clip-source" placeholder="https://… or “Le Monde, 3 Aug”" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="clip-title" className="text-xs">
                Title <span className="text-muted-foreground">(optional — first line otherwise)</span>
              </Label>
              <Input id="clip-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="clip-author" className="text-xs">
                Author
              </Label>
              <Input id="clip-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="clip-text" className="text-xs">
              Text
            </Label>
            <Textarea
              id="clip-text"
              autoFocus={!handoff}
              rows={handoff ? 14 : 10}
              placeholder="Paste here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(false);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void submit(true)} disabled={busy || !text.trim()}>
            Clip & open
          </Button>
          <Button onClick={() => void submit(false)} disabled={busy || !text.trim()}>
            Clip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
