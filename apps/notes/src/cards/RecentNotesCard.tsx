import { useNavigate } from "react-router";
import { formatHuman, type CardProps } from "@lifeline/core";
import { useNotes } from "../data/repo";
import { NOTE_TYPES, noteType, type NoteTypeDef } from "../domain/noteTypes";
import { excerpt } from "../domain/markdown";

/** Card: most recently edited notes (knobs: type filter, count). */
export function RecentNotesCard({ settings }: CardProps) {
  const type = String(settings.type ?? "");
  const count = Number(settings.count ?? 8);
  const notes = useNotes();
  const navigate = useNavigate();
  const list = notes
    .filter((n) => !type || n.type === type)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
  if (list.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No notes yet.</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((n) => {
        const def = noteType(n.type);
        const I = def.icon;
        return (
          <li key={n.id}>
            <button
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left"
              onClick={() => navigate(def.titleRule === "date" ? `/notes/journal?d=${n.title}` : `/notes/n/${n.id}`)}
            >
              <I className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate text-sm">{def.titleRule === "date" ? formatHuman(n.title) : n.title}</span>
              <span className="text-muted-foreground ml-auto truncate text-xs">{excerpt(n.body, 40)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const recentTypeOptions = [{ value: "", label: "All types" }, ...(NOTE_TYPES as readonly NoteTypeDef[]).map((t) => ({ value: t.id, label: t.plural }))];
