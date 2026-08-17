import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@lifeline/ui";
import { NOTE_TYPES, isTemplatable, type NoteTypeDef, type NoteTypeId } from "../domain/noteTypes";
import { ensureTemplateNote, useNotes } from "../data/repo";

/** Pick a Note type and open (creating if needed) its editable template note. */
export function TemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const notes = useNotes();
  const custom = new Set(notes.filter((n) => n.type === "template").map((n) => n.title.toLowerCase()));
  async function edit(type: NoteTypeId) {
    const t = await ensureTemplateNote(type);
    onOpenChange(false);
    navigate(`/notes/n/${t.id}`);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Note templates</DialogTitle>
          <DialogDescription>
            Each type's new-note text. Placeholders: <code>{"{{title}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{time}}"}</code>. Delete a template note to go back to the built-in default.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {(NOTE_TYPES as readonly NoteTypeDef[]).filter(isTemplatable).map((t) => {
            const I = t.icon;
            return (
              <li key={t.id}>
                <Button variant="ghost" className="w-full justify-start" onClick={() => void edit(t.id as NoteTypeId)}>
                  <I /> {t.label}
                  <span className="text-muted-foreground ml-auto text-xs">{custom.has(t.id) ? "customised" : "default"}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
