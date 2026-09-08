import { useState } from "react";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { Badge, Button } from "@lifeline/ui";
import { Play } from "lucide-react";
import { workType } from "../domain/workTypes";
import { start } from "../domain/rules";
import { byMedium } from "../domain/cardQueries";
import { patchWork, useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { EditWorkDialog } from "../components/WorkRow";
import type { Work } from "../domain/types";
import { mediumOf } from "./shared";
import { AuthorNames } from "../components/AuthorNames";

/** Card: the To read / watch / listen / play shelf — items not yet started, with a one-tap start. */
export function WantCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  const count = typeof settings.count === "number" && settings.count > 0 ? settings.count : 10;
  const sort = settings.sort === "title" ? "title" : "added";
  const [editing, setEditing] = useState<Work | null>(null);
  const rows = byMedium(items, medium)
    .filter((m) => m.engagement === "UNSTARTED")
    .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : b.addedOn.localeCompare(a.addedOn) || a.title.localeCompare(b.title)))
    .slice(0, count);
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing waiting.</div>;
  }
  return (
    <>
      <ul className="grid content-start gap-1 overflow-y-auto">
        {rows.map((m) => {
          const def = workType(m.type);
          return (
            <li key={m.id} className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5" onClick={() => setEditing(m)}>
              <Cover item={m} className="h-8 w-6" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.title}</div>
                {m.authors.length > 0 && <div className="text-muted-foreground truncate text-xs"><AuthorNames item={m} plain /></div>}
              </div>
              {!medium && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {def.label}
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                title={def.startVerb}
                aria-label={`${def.startVerb} ${m.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void patchWork(m, start());
                }}
              >
                <Play className="size-3" /> {def.startVerb}
              </Button>
            </li>
          );
        })}
      </ul>
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
    </>
  );
}
