import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { noteType, type NoteTypeId } from "../domain/noteTypes";
import { findByTitle } from "../data/repo";

/** Title prompt for a new note of a name-titled type. */
export function NewNoteDialog({ type, folder = "", onOpenChange, onCreate }: { type: NoteTypeId | null; folder?: string; onOpenChange: (o: boolean) => void; onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(""), [type]);
  const def = type ? noteType(type) : null;
  async function submit() {
    const t = title.trim();
    if (!t) return;
    if (await findByTitle(t, folder)) return void toast.error(`A note named “${t}” already exists in ${folder || "the root"}`);
    await onCreate(t);
  }
  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            New {def?.label.toLowerCase() ?? "note"}
            {folder && <span className="text-muted-foreground font-normal"> in {folder}</span>}
          </DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder={def?.id === "person" ? "Name" : def?.id === "place" ? "Place" : "Title"} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
