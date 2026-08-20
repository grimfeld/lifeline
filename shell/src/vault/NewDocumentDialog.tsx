import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { createDocument, docHref, documentType, singularOf } from "@lifeline/core";

/** Title prompt for a new Document of a name-titled type; creates it from the type's template and opens it. */
export function NewDocumentDialog({ type, folder, onOpenChange }: { type: string | null; folder?: string; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  useEffect(() => setTitle(""), [type]);
  const def = type ? documentType(type) : undefined;
  async function submit() {
    const t = title.trim();
    if (!t || !type) return;
    try {
      const d = await createDocument({ type, title: t, folder });
      onOpenChange(false);
      navigate(docHref(d));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            New {def ? singularOf(def).toLowerCase() : "document"}
            {folder && <span className="text-muted-foreground font-normal"> in {folder}</span>}
          </DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
