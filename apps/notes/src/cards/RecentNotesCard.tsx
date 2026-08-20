import { useNavigate } from "react-router";
import { docHref, documentType, excerpt, formatHuman, matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { TagChips } from "@lifeline/ui";
import { useNotes } from "../data/repo";
import { useTypeOptions } from "../data/options";

/** Card: most recently edited notes (knobs: type filter, count). */
export function RecentNotesCard({ settings }: CardProps) {
  const type = String(settings.type ?? "");
  const count = Number(settings.count ?? 8);
  const notes = useNotes();
  const navigate = useNavigate();
  const filter = useTagFilter();
  const list = notes
    .filter((n) => !type || n.type === type)
    .filter((n) => matchesTagFilter(n.tags, filter))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
  if (list.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No notes yet.</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((n) => {
        const def = documentType(n.type);
        const I = def?.icon;
        const tags = n.tags;
        return (
          <li key={n.id}>
            <button className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(docHref(n, def))}>
              {I && <I className="text-muted-foreground size-3.5 shrink-0" />}
              <span className="truncate text-sm">{def?.titleRule === "date" ? formatHuman(n.title) : n.title}</span>
              <TagChips tags={tags.slice(0, 3)} size="xs" className="shrink-0" />
              <span className="text-muted-foreground ml-auto truncate text-xs">{excerpt(n.body, 40)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Options hook for the card's type knob (entity field, "" = all). */
export function useRecentTypeOptions() {
  return useTypeOptions();
}
