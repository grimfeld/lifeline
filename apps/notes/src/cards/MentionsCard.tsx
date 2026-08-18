import { useNavigate } from "react-router";
import { formatHuman, type CardProps, type CardSettings } from "@lifeline/core";
import { CardUnavailable } from "@lifeline/ui";
import { useNoteIndex } from "../data/repo";
import { mentionsOf } from "../domain/mentions";
import { noteHref } from "../workspace/useOpenNote";

/** Card: linked mentions of one note, newest first (knobs: target note, count). */
export function MentionsCard({ settings, configure }: CardProps) {
  const target = String(settings.target ?? "");
  const count = Number(settings.count ?? 10);
  const index = useNoteIndex();
  const navigate = useNavigate();
  const note = index.byId.get(target);
  if (!note) return <CardUnavailable message="That note no longer exists." onConfigure={configure} />;
  const list = mentionsOf(index, note.id).slice(0, count);
  if (list.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing links to {note.title} yet.</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((m, i) => {
        const src = index.byId.get(m.noteId);
        if (!src) return null;
        return (
          <li key={`${m.noteId}-${i}`}>
            <button className="hover:bg-accent flex w-full flex-col rounded-md px-1 py-0.5 text-left" onClick={() => navigate(noteHref(src))}>
              <span className="truncate text-sm">{src.type === "daily" ? formatHuman(src.title) : src.title}</span>
              {m.context && <span className="text-muted-foreground truncate text-xs">{m.context}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Instance title hook: "Mentions · <title>". */
export function useMentionsTitle(s: CardSettings): string {
  const index = useNoteIndex();
  const n = index.byId.get(String(s.target ?? ""));
  return n ? `Mentions · ${n.type === "daily" ? formatHuman(n.title) : n.title}` : "Mentions";
}
