import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Textarea, toast } from "@lifeline/ui";
import type { CommandDef } from "@lifeline/core";
import { CalendarDays, FilePlus, Settings2, Zap } from "lucide-react";
import { appendToDaily, createNote } from "./data/repo";
import { isTemplatable, type NoteTypeId } from "./domain/noteTypes";
import { useNoteTypes } from "./data/noteTypes";
import { NotesSettingsDialog } from "./components/NotesSettingsDialog";
import { useMemo } from "react";
import { NewNoteDialog } from "./components/NewNoteDialog";

function QuickCaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  async function submit() {
    if (!text.trim()) return;
    await appendToDaily(text);
    toast.success("Captured in today's journal");
    setText("");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick capture</DialogTitle>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={3}
          placeholder="A thought, a moment… appended to today's note with the time."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          }}
        />
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!text.trim()}>
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewNoteCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [type, setType] = useState<NoteTypeId | null>(null);
  const navigate = useNavigate();
  const types = useNoteTypes();
  if (type) {
    return (
      <NewNoteDialog
        type={type}
        onOpenChange={(o) => {
          if (!o) {
            setType(null);
            onOpenChange(false);
          }
        }}
        onCreate={async (title) => {
          const n = await createNote({ type, title });
          setType(null);
          onOpenChange(false);
          navigate(`/notes/n/${n.id}`);
        }}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
        </DialogHeader>
        <ul className="grid gap-1">
          {types
            .filter((t) => t.titleRule !== "date" && isTemplatable(t))
            .map((t) => {
              const I = t.icon;
              return (
                <li key={t.id}>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setType(t.id as NoteTypeId)}>
                    <I /> {t.label}
                  </Button>
                </li>
              );
            })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export const noteCommands: CommandDef[] = [
  { id: "notes.today", title: "Open today's journal", keywords: ["daily", "diary", "journal"], icon: CalendarDays, run: ({ navigate }) => navigate("/notes/journal") },
  { id: "notes.new", title: "New note…", keywords: ["person", "place", "note"], icon: FilePlus, dialog: NewNoteCommandDialog },
  { id: "notes.capture", title: "Quick capture", keywords: ["journal", "log", "thought"], icon: Zap, dialog: QuickCaptureDialog },
  { id: "notes.settings", title: "Note types & templates…", keywords: ["template", "type", "settings", "daily"], icon: Settings2, dialog: NotesSettingsDialog },
];

/** One "New <type>…" command per creatable Note type — including user-defined ones (Core `useCommands` hook). */
export function useNoteTypeCommands(): CommandDef[] {
  const types = useNoteTypes();
  return useMemo(
    () =>
      types
        .filter((t) => t.titleRule === "name" && isTemplatable(t))
        .map((t) => ({
          id: `notes.new.${t.id}`,
          title: `New ${t.label.toLowerCase()}…`,
          keywords: ["note", t.plural.toLowerCase()],
          icon: t.icon,
          dialog: function NewTypedNoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
            const navigate = useNavigate();
            return (
              <NewNoteDialog
                type={open ? t.id : null}
                onOpenChange={onOpenChange}
                onCreate={async (title) => {
                  const n = await createNote({ type: t.id, title });
                  onOpenChange(false);
                  navigate(`/notes/n/${n.id}`);
                }}
              />
            );
          },
        })),
    [types],
  );
}
