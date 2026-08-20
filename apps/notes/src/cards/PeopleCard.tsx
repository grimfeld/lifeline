import { useNavigate } from "react-router";
import { addDays, displayTitle, docHref, documentType, formatHuman, todayStr, useDocumentTypes, useLinkIndex, type CardProps, type CardSettings } from "@lifeline/core";
import { rankMentions } from "../domain/mentions";
import { DAILY, TEMPLATE } from "../domain/types";

/** Card: Documents of a type ranked by how many recent daily notes mention them (knobs: days, count, type). */
export function PeopleCard({ settings }: CardProps) {
  const days = Number(settings.days ?? 30);
  const count = Number(settings.count ?? 10);
  const type = String(settings.type ?? "");
  const index = useLinkIndex();
  const navigate = useNavigate();
  const since = addDays(todayStr(), -days);
  const list = rankMentions(index, index.docs, { type: type || undefined, since }).slice(0, count);
  if (list.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No one mentioned in the last {days} days.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((m) => {
        const n = index.byId.get(m.noteId);
        if (!n) return null;
        const I = documentType(n.type)?.icon;
        return (
          <li key={m.noteId}>
            <button className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(docHref(n))}>
              {I && <I className="text-muted-foreground size-3.5 shrink-0" />}
              <span className="truncate text-sm">{displayTitle(n)}</span>
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

/** Options hook for the type knob ("" = any type): every linkable, non-internal type. */
export function usePeopleTypeOptions() {
  return useDocumentTypes()
    .filter((t) => !t.internal && t.linkable && t.id !== DAILY && t.id !== TEMPLATE)
    .map((t) => ({ value: t.id, label: t.label }));
}

export function peopleTitle(s: CardSettings): string {
  const t = String(s.type ?? "");
  const days = Number(s.days ?? 30);
  const d = t ? documentType(t) : undefined;
  return `${d ? d.label : t || "Mentions"} · ${days}d`;
}
