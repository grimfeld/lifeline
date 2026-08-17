import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@lifeline/ui";
import { LayoutTemplate, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { isTemplatable, type NoteTypeDef, type NoteTypeId } from "../domain/noteTypes";
import { deleteNoteType, useNoteTypes, useUserNoteTypes, type NoteTypeRecord } from "../data/noteTypes";
import { ensureTemplateNote, useNotes } from "../data/repo";
import { NoteTypeEditor } from "./NoteTypeEditor";

/** Types & templates in one place: built-ins are fixed (templates editable), user types are created here. */
export function NotesSettingsDialog({ open, onOpenChange, initialTab = "types" }: { open: boolean; onOpenChange: (o: boolean) => void; initialTab?: "types" | "templates" }) {
  const types = useNoteTypes();
  const userTypes = useUserNoteTypes();
  const notes = useNotes();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<{ record: NoteTypeRecord | null; base?: NoteTypeDef } | null>(null);
  const customTemplates = new Set(notes.filter((n) => n.type === "template").map((n) => n.title.toLowerCase()));

  async function editTemplate(type: NoteTypeId) {
    const t = await ensureTemplateNote(type);
    onOpenChange(false);
    navigate(`/notes/n/${t.id}`);
  }
  async function removeType(r: NoteTypeRecord, builtIn: boolean) {
    const inUse = notes.filter((n) => n.type === r.typeId).length;
    await deleteNoteType(r.id);
    toast.success(builtIn ? `“${r.label}” reset to its built-in default` : `Type “${r.label}” deleted${inUse ? ` — ${inUse} note(s) now render as plain notes` : ""}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setEditing(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Note types & templates</DialogTitle>
          <DialogDescription>Types define a note's properties, icon and default folder; templates seed its text. Built-ins can be edited (reset restores the default); yours sync like notes.</DialogDescription>
        </DialogHeader>
        {editing !== null ? (
          <NoteTypeEditor record={editing.record} base={editing.base} existingIds={types.map((t) => t.id)} onDone={() => setEditing(null)} />
        ) : (
          <Tabs defaultValue={initialTab}>
            <TabsList>
              <TabsTrigger value="types">Types</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="types" className="grid gap-2 pt-2">
              <ul className="grid gap-1">
                {types.map((t) => {
                  const I = t.icon;
                  const rec = userTypes.find((r) => r.typeId === t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                      <I className="text-muted-foreground size-4" />
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground text-xs">{t.plural}</span>
                      {t.builtIn && (
                        <Badge variant="secondary" className="ml-1">
                          {t.overridden ? "built-in · edited" : "built-in"}
                        </Badge>
                      )}
                      {t.folder && !t.builtIn && <span className="text-muted-foreground text-xs">→ {t.folder}/</span>}
                      <span className="text-muted-foreground ml-auto text-xs">{t.properties.length} props</span>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing({ record: rec ?? null, base: t.builtIn ? t : undefined })} aria-label="Edit type">
                        <Pencil className="size-3.5" />
                      </Button>
                      {rec && (
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => void removeType(rec, !!t.builtIn)} aria-label={t.builtIn ? "Reset to default" : "Delete type"} title={t.builtIn ? "Reset to default" : "Delete type"}>
                          {t.builtIn ? <RotateCcw className="size-3.5" /> : <Trash2 className="size-3.5" />}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Button className="justify-self-start" onClick={() => setEditing({ record: null })}>
                <Plus /> New type
              </Button>
            </TabsContent>
            <TabsContent value="templates" className="grid gap-2 pt-2">
              <p className="text-muted-foreground text-xs">
                Placeholders: <code>{"{{title}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{time}}"}</code>. Delete a template note to restore the built-in default.
              </p>
              <ul className="grid gap-1">
                {types.filter(isTemplatable).map((t) => {
                  const I = t.icon;
                  return (
                    <li key={t.id}>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => void editTemplate(t.id)}>
                        <I /> {t.label}
                        <span className="text-muted-foreground ml-auto text-xs">{customTemplates.has(t.id) ? "customised" : "default"}</span>
                        <LayoutTemplate className="text-muted-foreground size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
