import { useMemo } from "react";
import { useNavigate } from "react-router";
import { formatHuman, type CardProps } from "@lifeline/core";
import { useNoteIndex } from "../data/repo";
import { noteType } from "../data/noteTypes";
import { searchNotes } from "../domain/search";
import { noteHref } from "../workspace/useOpenNote";
import type { Note } from "../domain/types";

/** Card: a saved full-text search over titles, aliases and bodies (knobs: query, count, type). */
export function SavedSearchCard({ settings }: CardProps) {
  const query = String(settings.query ?? "");
  const count = Number(settings.count ?? 12);
  const type = String(settings.type ?? "");
  const index = useNoteIndex();
  const navigate = useNavigate();
  const hits = useMemo(() => {
    const pool = Array.from(index.byId.values()).filter((n) => n.type !== "template" && (!type || n.type === type));
    const aliasesOf = (n: Note) => {
      const a = index.properties(n.id).aliases;
      return Array.isArray(a) ? a : typeof a === "string" && a ? [a] : [];
    };
    return searchNotes(pool, query, aliasesOf).slice(0, count);
  }, [index, query, type, count]);
  if (!query.trim()) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Set a query in the card settings.</div>;
  if (hits.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No notes match “{query}”.</div>;
  return (
    <ul className="grid h-full content-start gap-1 overflow-y-auto">
      {hits.map(({ note: n, snippet }) => {
        const I = noteType(n.type).icon;
        return (
          <li key={n.id}>
            <button className="hover:bg-accent flex w-full flex-col gap-0.5 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(noteHref(n))}>
              <span className="flex items-center gap-2 text-sm">
                <I className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{n.type === "daily" ? formatHuman(n.title) : n.title}</span>
              </span>
              <span className="text-muted-foreground line-clamp-2 text-xs">{snippet}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const searchTitle = (settings: CardProps["settings"]) => (String(settings.query ?? "").trim() ? `“${String(settings.query).trim()}”` : "Saved search");
