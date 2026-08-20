import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Textarea, toast } from "@lifeline/ui";
import { createDocument, docHref, useDocumentTypes, type CommandDef, type DocumentTypeDef, singularOf } from "@lifeline/core";
import { CalendarDays, FilePlus, Settings2, Zap } from "lucide-react";
import { appendToDaily } from "./data/repo";
import { DAILY, TEMPLATE } from "./domain/types";

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

/** Title prompt; creates a Document of `type` from its template and opens it. */
export function NewTypedDialog({ type, open, onOpenChange }: { type: DocumentTypeDef; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  async function submit() {
    const t = title.trim();
    if (!t) return;
    try {
      const d = await createDocument({ type: type.id, title: t });
      setTitle("");
      onOpenChange(false);
      navigate(docHref(d));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New {singularOf(type).toLowerCase()}</DialogTitle>
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

/** Types the "New…" commands offer: body-first, name-titled, not internal, not templates. */
function useCreatable(): DocumentTypeDef[] {
  const types = useDocumentTypes();
  return useMemo(() => types.filter((t) => !t.internal && t.body === "required" && t.titleRule === "name" && t.id !== TEMPLATE && t.id !== DAILY), [types]);
}

function NewNoteCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [type, setType] = useState<DocumentTypeDef | null>(null);
  const types = useCreatable();
  if (type) {
    return (
      <NewTypedDialog
        type={type}
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setType(null);
            onOpenChange(false);
          }
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
          {types.map((t) => {
            const I = t.icon;
            return (
              <li key={t.id}>
                <Button variant="ghost" className="w-full justify-start" onClick={() => setType(t)}>
                  {I && <I />} {t.label}
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
  { id: "notes.today", title: "Open today's journal", keywords: ["daily", "diary", "journal"], icon: CalendarDays, run: ({ navigate }) => navigate("/vault/journal") },
  { id: "notes.new", title: "New note…", keywords: ["person", "place", "note"], icon: FilePlus, dialog: NewNoteCommandDialog },
  { id: "notes.capture", title: "Quick capture", keywords: ["journal", "log", "thought"], icon: Zap, dialog: QuickCaptureDialog },
  { id: "notes.settings", title: "Document types & templates…", keywords: ["template", "type", "settings", "daily", "bases"], icon: Settings2, run: ({ navigate }) => navigate("/base") },
];

/** One "New <type>…" command per creatable body-first type — user-defined ones included (Core `useCommands` hook). */
export function useNoteTypeCommands(): CommandDef[] {
  const types = useCreatable();
  return useMemo(
    () =>
      types.map((t) => ({
        id: `notes.new.${t.id}`,
        title: `New ${singularOf(t).toLowerCase()}…`,
        keywords: ["note", "document", t.label.toLowerCase()],
        icon: t.icon,
        dialog: function NewTypedNoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
          return <NewTypedDialog type={t} open={open} onOpenChange={onOpenChange} />;
        },
      })),
    [types],
  );
}
