import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { Play } from "lucide-react";
import { practiceQueue } from "../domain/practice";
import { LANGUAGES_HREF } from "../domain/types";
import { useActiveLanguage, useItems, useLanguageRecalls } from "../data/repo";

/** "Due today" (a Card): the active Language's due and new Prompts, one tap into Practice. */
export function DueCard(_: CardProps) {
  const language = useActiveLanguage();
  const items = useItems(language?.id);
  const recalls = useLanguageRecalls(language?.id);
  // Prompts fall due as time passes, not only when something is written: re-read the clock every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const q = useMemo(() => (language ? practiceQueue(items.filter((i) => !i.paused), recalls, { now, newCap: language.newCap }) : null), [language, items, recalls, now]);

  if (!language || !q) return <CardUnavailable message="No language yet" />;
  return (
    <div className="flex h-full flex-col justify-between gap-2 p-3">
      <div className="grid">
        <span className="text-muted-foreground text-xs">{language.name}</span>
        <span className="text-3xl font-semibold tabular-nums">{q.due + q.newToday}</span>
        <span className="text-muted-foreground text-xs">
          {q.due} due · {q.newToday} new
        </span>
      </div>
      <Button size="sm" asChild>
        <Link to={LANGUAGES_HREF}>
          <Play /> Practise
        </Link>
      </Button>
    </div>
  );
}
