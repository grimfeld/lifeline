import { useNavigate } from "react-router";
import { addDays, excerpt, formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { useNotes } from "../data/repo";
import { onThisDay } from "../domain/journalStats";
import { DAILY, journalHref } from "../domain/types";

/** Card: daily notes from the same day in earlier years (knobs: years, week lookbacks, day offset). */
export function OnThisDayCard({ settings }: CardProps) {
  const years = String(settings.years ?? "all") === "last" ? "last" : "all";
  const alsoWeeks = String(settings.alsoWeeks ?? "no") === "yes";
  const offset = Number(settings.dayOffset ?? 0);
  const today = addDays(todayStr(), offset);
  const notes = useNotes();
  const navigate = useNavigate();
  const dailies = notes.filter((n) => n.type === DAILY);
  const byDate = new Map(dailies.map((n) => [n.title, n]));
  const hits = onThisDay([...byDate.keys()], today, { years, alsoWeeks });
  if (hits.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center p-2 text-center text-sm">Nothing on this day in earlier years yet.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto">
      {offset !== 0 && <div className="text-muted-foreground text-xs">{formatHuman(today)}</div>}
      <ul className="grid content-start gap-1">
        {hits.map((h) => {
          const n = byDate.get(h.date);
          const text = n ? excerpt(n.body, 240) : "";
          return (
            <li key={h.date}>
              <button className="hover:bg-accent flex w-full flex-col gap-0.5 rounded-md px-1.5 py-1 text-left" onClick={() => navigate(journalHref(h.date))}>
                <span className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{h.label}</span> · {formatHuman(h.date)}
                </span>
                <span className="text-sm">{text || <span className="text-muted-foreground italic">Empty entry.</span>}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
