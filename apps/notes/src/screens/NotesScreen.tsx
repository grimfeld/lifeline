import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, CardContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { LayoutTemplate, Plus, Search } from "lucide-react";
import { NOTE_TYPES, isTemplatable, type NoteTypeDef, type NoteTypeId } from "../domain/noteTypes";
import { excerpt } from "../domain/markdown";
import { createNote, useNoteIndex, useNotes } from "../data/repo";
import type { Note } from "../domain/types";
import { NewNoteDialog } from "../components/NewNoteDialog";
import { TemplatesDialog } from "../components/TemplatesDialog";

/** All notes grouped by type, with search over title, aliases, tags and text. */
export function NotesScreen() {
  const notes = useNotes();
  const index = useNoteIndex();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [newType, setNewType] = useState<NoteTypeId | null>(null);
  const [typeFilter, setTypeFilter] = useState<NoteTypeId | "all">("all");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (!query) return true;
      const props = index.properties(n.id);
      const aliases = Array.isArray(props.aliases) ? props.aliases.join(" ") : "";
      return `${n.title} ${aliases} ${n.body}`.toLowerCase().includes(query);
    });
  }, [notes, q, typeFilter, index]);

  const groups = (NOTE_TYPES as readonly NoteTypeDef[])
    .map((t) => ({ type: t, notes: filtered.filter((n) => n.type === t.id).sort(sortFor(t)) }))
    .filter((g) => g.notes.length > 0);

  return (
    <div className="mx-auto grid w-full max-w-5xl content-start gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <div className="relative ml-auto">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input className="h-9 w-64 pl-8" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus /> New note
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(NOTE_TYPES as readonly NoteTypeDef[]).filter(isTemplatable).map((t) => {
              const I = t.icon;
              return (
                <DropdownMenuItem key={t.id} onClick={() => (t.titleRule === "date" ? navigate("/app/journal") : setNewType(t.id as NoteTypeId))}>
                  <I /> {t.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTemplatesOpen(true)}>
              <LayoutTemplate /> Edit templates…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={typeFilter === "all" ? "secondary" : "ghost"} onClick={() => setTypeFilter("all")}>
          All · {notes.length}
        </Button>
        {(NOTE_TYPES as readonly NoteTypeDef[]).map((t) => {
          const n = notes.filter((x) => x.type === t.id).length;
          return (
            <Button key={t.id} size="sm" variant={typeFilter === t.id ? "secondary" : "ghost"} onClick={() => setTypeFilter(t.id as NoteTypeId)}>
              {t.plural} · {n}
            </Button>
          );
        })}
      </div>
      {groups.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">{notes.length === 0 ? "No notes yet. Start with today's journal." : "No notes match."}</CardContent>
        </Card>
      ) : (
        groups.map(({ type, notes: list }) => {
          const I = type.icon;
          return (
            <section key={type.id} className="grid gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <I className="size-3.5" /> {type.plural} · {list.length}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((n) => (
                  <li key={n.id}>
                    <button
                      className="hover:bg-accent/50 h-full w-full rounded-lg border p-3 text-left"
                      onClick={() => navigate(type.titleRule === "date" ? `/app/journal?d=${n.title}` : `/app/notes/${n.id}`)}
                    >
                      <div className="truncate text-sm font-medium">{type.titleRule === "date" ? formatHuman(n.title) : n.title}</div>
                      <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{excerpt(n.body, 120) || <span className="italic">Empty</span>}</div>
                      <div className="text-muted-foreground mt-1 text-[10px]">
                        {index.backlinksTo({ kind: "note", noteId: n.id }).length > 0 && `${index.backlinksTo({ kind: "note", noteId: n.id }).length} mentions`}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <NewNoteDialog
        type={newType}
        onOpenChange={(o) => !o && setNewType(null)}
        onCreate={async (title) => {
          const n = await createNote({ type: newType!, title });
          setNewType(null);
          navigate(`/app/notes/${n.id}`);
        }}
      />
    </div>
  );
}

function sortFor(t: NoteTypeDef): (a: Note, b: Note) => number {
  return t.titleRule === "date" ? (a, b) => b.title.localeCompare(a.title) : (a, b) => a.title.localeCompare(b.title);
}

