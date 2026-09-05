import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Input, TagChips } from "@lifeline/ui";
import { basePath, docHref, documentType, excerpt, formatHuman, useDocuments } from "@lifeline/core";
import { FileText, Plus, Table2 } from "lucide-react";
import { NewTypedDialog } from "../commands";
import { searchNotes } from "../domain/search";
import { NOTE, type Note } from "../domain/types";

/**
 * The Notes desk (ADR 0045): a Dashboard index in the Study group, beside
 * Writings and Clippings. It lists, searches and starts Notes; the body it
 * opens belongs to the Vault, so every row is a link into the Vault's editor.
 *
 * Notes only — daily notes are the Journal's and templates are machinery. The
 * axis is recency, because folders and tags are the Vault tree's job and this
 * screen would otherwise be a worse copy of it.
 *
 * Below `md` (ADR 0021) the header stacks and a row is one tap target.
 */
export function NotesScreen() {
  const notes = useDocuments<Note>(NOTE);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const def = useMemo(() => documentType(NOTE), []);

  const rows = useMemo(() => {
    if (q.trim()) return searchNotes(notes, q, (n) => (Array.isArray(n.aliases) ? (n.aliases as string[]) : []));
    return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((note) => ({ note, snippet: excerpt(note.body ?? "", 200) }));
  }, [notes, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="grid gap-2 border-b px-3 py-2 md:flex md:items-center md:px-4">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground size-5 shrink-0" />
          <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
          <Badge variant="secondary">{notes.length}</Badge>
          <div className="ml-auto flex items-center gap-1 md:order-last md:ml-0">
            <Button size="sm" variant="ghost" asChild>
              <Link to={basePath(NOTE)} aria-label="Open the Notes Base">
                <Table2 />
                <span className="max-md:hidden">Base</span>
              </Link>
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> New
            </Button>
          </div>
        </div>
        <Input className="h-8 md:ml-4 md:w-56" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </header>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {rows.length === 0 && (
          <li className="text-muted-foreground px-4 py-8 text-center text-sm">{q.trim() ? `Nothing matches “${q.trim()}”.` : "No notes yet. Start one with “New”."}</li>
        )}
        {rows.map(({ note, snippet }) => (
          <li key={note.id}>
            {/* The whole row is the link: a phone has no hover to find the small target by (ADR 0021). */}
            <Link to={docHref(note)} className="hover:bg-accent/50 block px-4 py-2">
              <div className="font-medium">{note.title}</div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                {note.folder && <span>{note.folder}</span>}
                <span>{formatHuman(note.updatedAt.slice(0, 10))}</span>
                {note.tags.length > 0 && <TagChips tags={note.tags} size="xs" />}
              </div>
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{snippet}</p>
            </Link>
          </li>
        ))}
      </ul>
      {def && <NewTypedDialog type={def} open={open} onOpenChange={setOpen} />}
    </div>
  );
}
