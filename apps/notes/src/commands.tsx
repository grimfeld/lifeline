import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Textarea, toast } from "@lifeline/ui";
import { createDocument, docHref, lockPrivate, todayStr, openPrivateDialog, useDocumentTypes, usePrivateGate, type CommandDef, type DocumentTypeDef, singularOf } from "@lifeline/core";
import { CalendarDays, FilePlus, ImageOff, KeyRound, Lock, LockOpen, Settings2, ShieldOff, Zap } from "lucide-react";
import { TemplateSelect } from "@lifeline/editor";
import { AttachmentsCleanupDialog } from "./components/AttachmentsCleanupDialog";
import { appendToDaily } from "./data/repo";
import { DAILY, TEMPLATE, journalHref, periodHref } from "./domain/types";
import { journalPageOf } from "./domain/periods";

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
  const [templateId, setTemplateId] = useState("");
  const navigate = useNavigate();
  async function submit() {
    const t = title.trim();
    if (!t) return;
    try {
      const d = await createDocument({ type: type.id, title: t, templateId: templateId || undefined });
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
        <TemplateSelect type={type.id} value={templateId} onChange={setTemplateId} />
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

/**
 * Inline (ADR 0088): a typed date or period key opens that Day or review. The
 * page opens and nothing is made — a page only makes its Document when it is
 * today's Day or the current stretch, as it does however it is reached.
 */
const openJournalPage: CommandDef = {
  id: "notes.open-date",
  title: "Open a date in the Journal",
  icon: CalendarDays,
  inline: (query) => {
    const page = journalPageOf(query);
    if (!page) return undefined;
    const href = page.kind === "day" ? journalHref(page.key, todayStr()) : periodHref(page.key);
    return { label: page.label, run: ({ navigate }) => navigate(href) };
  },
};

export const noteCommands: CommandDef[] = [
  openJournalPage,
  { id: "notes.today", title: "Open today", keywords: ["daily", "diary", "journal", "day"], icon: CalendarDays, run: ({ navigate }) => navigate("/app/journal") },
  { id: "notes.week", title: "Open this week's review", keywords: ["week", "weekly", "review", "journal"], icon: CalendarDays, run: ({ navigate }) => navigate("/app/journal/p/week") },
  { id: "notes.month", title: "Open this month's review", keywords: ["month", "monthly", "review", "journal"], icon: CalendarDays, run: ({ navigate }) => navigate("/app/journal/p/month") },
  { id: "notes.new", title: "New note…", keywords: ["person", "place", "note"], icon: FilePlus, dialog: NewNoteCommandDialog },
  { id: "notes.capture", title: "Quick capture", keywords: ["journal", "log", "thought"], icon: Zap, dialog: QuickCaptureDialog, capture: true },
  { id: "notes.settings", title: "Document types & templates…", keywords: ["template", "type", "settings", "daily", "bases"], icon: Settings2, run: ({ navigate }) => navigate("/base") },
  { id: "notes.attachments.cleanup", title: "Clean up unused attachments…", keywords: ["image", "attachment", "orphan", "storage", "delete"], icon: ImageOff, dialog: AttachmentsCleanupDialog },
];

/** The Private folder's commands (ADR 0038), shaped by the gate's state: set up / unlock / lock / change password / turn off. */
export function usePrivateCommands(): CommandDef[] {
  const gate = usePrivateGate();
  return useMemo(() => {
    if (!gate.configured) {
      return [{ id: "notes.private.setup", title: "Set up private notes…", keywords: ["private", "password", "lock", "secret"], icon: Lock, run: () => openPrivateDialog("setup") }];
    }
    const out: CommandDef[] = gate.locked
      ? [{ id: "notes.private.unlock", title: "Unlock private notes…", keywords: ["private", "password", "lock"], icon: LockOpen, run: () => openPrivateDialog("unlock") }]
      : [{ id: "notes.private.lock", title: "Lock private notes", keywords: ["private", "password", "lock"], icon: Lock, run: () => void lockPrivate() }];
    out.push({ id: "notes.private.change", title: "Change private notes password…", keywords: ["private", "password"], icon: KeyRound, run: () => openPrivateDialog("change") });
    if (!gate.locked) out.push({ id: "notes.private.disable", title: "Turn off private notes…", keywords: ["private", "password", "remove"], icon: ShieldOff, run: () => openPrivateDialog("disable") });
    return out;
  }, [gate.configured, gate.locked]);
}

/** Every live command of the Notes App: the per-type "New…" ones and the Private folder's. */
export function useNotesCommands(): CommandDef[] {
  const types = useNoteTypeCommands();
  const priv = usePrivateCommands();
  return useMemo(() => [...types, ...priv], [types, priv]);
}

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
