import { useMemo, useState } from "react";
import { Link } from "react-router";
import { DAY_TYPE, EVENT_TYPE, formatHuman, todayStr, useDocuments, type Document, type LinkIndex } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Images, Plus } from "lucide-react";
import { eventBegun, memoryFromEvent } from "../domain/event";
import { panelMemories } from "../domain/panel";
import { agoLabel, remember } from "../domain/remember";
import { MEMORY, memoryHref, type Memory } from "../domain/types";
import { MemoryPhoto } from "./MemoryPhoto";
import { NewMemoryDialog } from "./NewMemoryDialog";

/**
 * The Memories panel (ADR 0137), drawn in an Event's Peek: the Memories about
 * the Event as thumbnails, each opening its Memory, and Add a memory once the
 * Event has begun. An Event that has not begun and has none shows nothing, and
 * so does any other Document. On a Day (the Journal and the Vault) it lists the
 * Memories dated that day, and nothing when there are none.
 */
export function MemoriesPanel({ doc }: { doc: Document; index: LinkIndex }) {
  const memories = useDocuments<Memory>(MEMORY);
  const [adding, setAdding] = useState(false);
  // Another's step, in memory for the current date only: a new date starts over.
  const [another, setAnother] = useState({ date: "", step: 0 });
  // Stable, or the dialog would reset its fields on every render while open.
  const initial = useMemo(() => memoryFromEvent(doc), [doc.id, doc.title, doc.date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (doc.type !== EVENT_TYPE && doc.type !== DAY_TYPE) return null;
  const mine = panelMemories(doc, memories);
  const begun = eventBegun(doc);
  const today = todayStr();
  const step = another.date === today ? another.step : 0;
  const recalled = doc.type === DAY_TYPE && doc.title === today ? remember(memories, today, step) : undefined;
  if (!mine.length && !begun && !recalled) return null;
  return (
    <section aria-label="Memories" className="grid min-w-0 gap-2 text-sm">
      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase">
        <Images className="size-3.5" style={{ color: "var(--chart-orange)" }} /> Memories
      </h3>
      {recalled && (
        <div aria-label="Remember" role="group" className="grid min-w-0 gap-1.5">
          <h4 className="text-muted-foreground text-sm font-medium">Remember</h4>
          <div className="flex min-w-0 items-start gap-3">
            <Link to={memoryHref(recalled.memory.id)} aria-hidden tabIndex={-1} className="block w-20 shrink-0">
              <MemoryPhoto
                body={recalled.memory.body}
                className="size-20 rounded-md"
                onMissing={() => <span className="bg-muted line-clamp-3 flex size-20 items-center justify-center break-words rounded-md p-1 text-center text-xs">{recalled.memory.title}</span>}
              />
            </Link>
            <div className="grid min-w-0 gap-0.5">
              <Link to={memoryHref(recalled.memory.id)} className="min-w-0 break-words font-medium hover:underline">
                {recalled.memory.title}
              </Link>
              <span className="text-muted-foreground text-xs">
                {formatHuman(recalled.memory.date)} · {agoLabel(recalled.memory.date, today)}
              </span>
              {recalled.another && (
                <Button type="button" variant="outline" size="sm" className="mt-1 w-fit" onClick={() => setAnother({ date: today, step: step + 1 })}>
                  Another
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="flex min-w-0 flex-wrap gap-2">
          {mine.map((m) => (
            <li key={m.id} className="min-w-0">
              <Link to={memoryHref(m.id)} title={m.title} className="block w-20 min-w-0">
                <MemoryPhoto
                  body={m.body}
                  className="size-20 rounded-md"
                  onMissing={() => <span className="bg-muted line-clamp-3 flex size-20 items-center justify-center break-words rounded-md p-1 text-center text-xs">{m.title}</span>}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {begun && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add a memory
          </Button>
          <NewMemoryDialog open={adding} onOpenChange={setAdding} initial={initial} />
        </div>
      )}
    </section>
  );
}
