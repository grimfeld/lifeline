import { useNavigate } from "react-router";
import { addDays, formatHuman, todayStr, type CardProps, type CardSettings } from "@lifeline/core";
import { useNoteIndex, useNotes } from "../data/repo";
import { noteType, useNoteTypes } from "../data/noteTypes";
import { rankMentions } from "../domain/mentions";
import { noteHref } from "../workspace/useOpenNote";

/** Card: notes of a type ranked by how many recent daily notes mention them (knobs: days, count, type). */
export function PeopleCard({ settings }: CardProps) {
  const days = Number(settings.days ?? 30);
  const count = Number(settings.count ?? 10);
  const type = String(settings.type ?? "");
  const notes = useNotes();
  const index = useNoteIndex();
  const navigate = useNavigate();
  const since = addDays(todayStr(), -days);
  const list = rankMentions(index, notes, { type: type || undefined, since }).slice(0, count);
  if (list.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No one mentioned in the last {days} days.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((m) => {
        const n = index.byId.get(m.noteId);
        if (!n) return null;
        const I = noteType(n.type).icon;
        return (
          <li key={m.noteId}>
            <button className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(noteHref(n))}>
              <I className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate text-sm">{n.title}</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {m.count} · last {formatHuman(m.last)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Options hook for the type knob ("" = any type). */
export function usePeopleTypeOptions() {
  return useNoteTypes()
    .filter((t) => t.id !== "daily" && t.id !== "template")
    .map((t) => ({ value: t.id, label: t.plural }));
}

export function peopleTitle(s: CardSettings): string {
  const t = String(s.type ?? "");
  const days = Number(s.days ?? 30);
  return `${t ? noteType(t).plural : "Mentions"} · ${days}d`;
}
