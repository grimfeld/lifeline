import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from "@lifeline/ui";
import { vaultDocPath } from "@lifeline/core";
import { canonical, parseRef } from "../domain/refs";
import { CHARACTER, CONCEPT } from "../domain/types";
import { addReference, noteOnRef } from "../data/repo";

/** New Character / Concept: a name, its other names, a first line. */
export function ReferenceDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (o: boolean) => void; type: typeof CHARACTER | typeof CONCEPT }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAliases("");
    setBody("");
  }, [open]);
  const noun = type === CHARACTER ? "character" : "concept";

  async function submit() {
    if (!title.trim()) return void toast.error("Name required");
    try {
      const doc = await addReference(type, { title, aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean), body });
      toast.success(`${title.trim()} added`);
      onOpenChange(false);
      navigate(vaultDocPath(doc.id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {noun}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ref-title">Name</Label>
            <Input id="ref-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === CHARACTER ? "Paul" : "Grace"} autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ref-aliases">Also written as</Label>
            <Input id="ref-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder={type === CHARACTER ? "Saul, Saul of Tarsus" : "charis"} />
            <p className="text-muted-foreground text-xs">Comma-separated; each resolves a wikilink to this {noun}.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ref-body">First line</Label>
            <Textarea id="ref-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional — the page opens for more" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Add {noun}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Note on a verse": the phone's capture — a reference and a thought, into a Note that opens with the link. */
export function NoteOnVerseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (!open) return;
    setRef("");
    setText("");
  }, [open]);
  const parsed = parseRef(ref);

  async function submit() {
    if (!parsed) return void toast.error("Write a reference like Jn 3:16 or Rom 8:28–30");
    try {
      const note = await noteOnRef(parsed, text);
      toast.success(`Note on ${canonical(parsed)}`);
      onOpenChange(false);
      navigate(vaultDocPath(note.id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note on a verse</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nov-ref">Verse</Label>
            <Input id="nov-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Jn 3:16–18" autoFocus />
            <p className="text-muted-foreground text-xs">{parsed ? `→ ${canonical(parsed)}` : "Book chapter:verse, ranges with a dash"}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nov-text">Thought</Label>
            <Textarea id="nov-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="What struck you" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!parsed}>
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
