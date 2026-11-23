import { useMemo, useState } from "react";
import { Link } from "react-router";
import { EVENT_TYPE, useDocuments, type Document, type LinkIndex } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Images, Plus } from "lucide-react";
import { eventBegun, memoryFromEvent } from "../domain/event";
import { MEMORY, memoryHref, type Memory } from "../domain/types";
import { MemoryPhoto } from "./MemoryPhoto";
import { NewMemoryDialog } from "./NewMemoryDialog";

/**
 * The Memories panel (ADR 0137), drawn in an Event's Peek: the Memories about
 * the Event as thumbnails, each opening its Memory, and Add a memory once the
 * Event has begun. An Event that has not begun and has none shows nothing, and
 * so does any other Document.
 */
export function MemoriesPanel({ doc }: { doc: Document; index: LinkIndex }) {
  const memories = useDocuments<Memory>(MEMORY);
  const [adding, setAdding] = useState(false);
  // Stable, or the dialog would reset its fields on every render while open.
  const initial = useMemo(() => memoryFromEvent(doc), [doc.id, doc.title, doc.date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (doc.type !== EVENT_TYPE) return null;
  const mine = memories.filter((m) => m.about?.includes(doc.id));
  const begun = eventBegun(doc);
  if (!mine.length && !begun) return null;
  return (
    <section aria-label="Memories" className="grid min-w-0 gap-2 text-sm">
      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase">
        <Images className="size-3.5" style={{ color: "var(--chart-orange)" }} /> Memories
      </h3>
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
