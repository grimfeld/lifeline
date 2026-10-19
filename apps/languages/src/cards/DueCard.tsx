import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { Play } from "lucide-react";
import { practiceQueue } from "../domain/practice";
import { KNOWLEDGE_HREF } from "../domain/types";
import { useAllMaterial, useRecalls, useTopics } from "../data/repo";

/**
 * "Due today" (a Card, ADR 0073): everything due across the live Topics, each
 * held to its own new cap, broken down by Topic — one tap into the Practice of
 * everything.
 */
export function DueCard(_: CardProps) {
  const topics = useTopics();
  const material = useAllMaterial();
  const recalls = useRecalls();
  // Prompts fall due as time passes, not only when something is written: re-read the clock every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const view = useMemo(() => {
    const live = topics.filter((t) => !t.archived);
    if (!live.length) return null;
    const rows = live
      .map((t) => {
        const q = practiceQueue(material.filter((m) => m.topicId === t.id && m.live), recalls, { now, newCap: t.newCap });
        return { id: t.id, name: t.name, ready: q.due + q.newToday, due: q.due, fresh: q.newToday };
      })
      .filter((r) => r.ready > 0)
      .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
    return { rows, due: rows.reduce((n, r) => n + r.due, 0), fresh: rows.reduce((n, r) => n + r.fresh, 0) };
  }, [topics, material, recalls, now]);

  if (!view) return <CardUnavailable message="No topic yet" />;
  return (
    <div className="flex h-full flex-col justify-between gap-2 p-3">
      <div className="grid min-w-0">
        <span className="text-3xl font-semibold tabular-nums">{view.due + view.fresh}</span>
        <span className="text-muted-foreground text-xs">
          {view.due} due · {view.fresh} new
        </span>
        <ul className="mt-1 grid min-w-0 gap-0.5 text-xs">
          {view.rows.slice(0, 4).map((r) => (
            <li key={r.id} className="flex min-w-0 gap-2">
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">{r.ready}</span>
            </li>
          ))}
          {view.rows.length > 4 && <li className="text-muted-foreground">+{view.rows.length - 4} more</li>}
        </ul>
      </div>
      <Button size="sm" asChild>
        <Link to={`${KNOWLEDGE_HREF}?practice=all`}>
          <Play /> Practise
        </Link>
      </Button>
    </div>
  );
}
