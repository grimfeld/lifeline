import { useMemo } from "react";
import { Link } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { Play } from "lucide-react";
import { practiceQueue } from "../domain/practice";
import { KNOWLEDGE_HREF } from "../domain/types";
import { useActiveTopic, useMaterial, useTopicRecalls } from "../data/repo";

/** "Due today" (a Card): the active Topic's due and new Prompts, one tap into Practice. */
export function DueCard(_: CardProps) {
  const topic = useActiveTopic();
  const items = useMaterial(topic?.id);
  const recalls = useTopicRecalls(topic?.id);
  const q = useMemo(() => (topic ? practiceQueue(items.filter((i) => i.live), recalls, { now: new Date(), newCap: topic.newCap }) : null), [topic, items, recalls]);

  if (!topic || !q) return <CardUnavailable message="No topic yet" />;
  return (
    <div className="flex h-full flex-col justify-between gap-2 p-3">
      <div className="grid">
        <span className="text-muted-foreground text-xs">{topic.name}</span>
        <span className="text-3xl font-semibold tabular-nums">{q.due + q.newToday}</span>
        <span className="text-muted-foreground text-xs">
          {q.due} due · {q.newToday} new
        </span>
      </div>
      <Button size="sm" asChild>
        <Link to={KNOWLEDGE_HREF}>
          <Play /> Practise
        </Link>
      </Button>
    </div>
  );
}
