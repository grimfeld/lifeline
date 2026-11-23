import { useMemo, useState } from "react";
import { Link } from "react-router";
import { formatHuman, useDocuments } from "@lifeline/core";
import { Button, EmptyState, Page, PageHeader, PhoneDock } from "@lifeline/ui";
import { Images, Plus } from "lucide-react";
import { MemoryPhoto } from "../components/MemoryPhoto";
import { NewMemoryDialog } from "../components/NewMemoryDialog";
import { newestFirst } from "../domain/order";
import { MEMORY, memoryHref, type Memory } from "../domain/types";

/** A tile with no photo: the title alone, in the photo's place. */
function TitleOnly({ title }: { title: string }) {
  return (
    <div className="bg-muted text-muted-foreground flex size-full items-center justify-center p-3 text-center text-sm">
      <span className="line-clamp-4 min-w-0 break-words">{title}</span>
    </div>
  );
}

/** One Memory in the grid: its first photo (or its title), its title and its date; opens the Memory. */
function MemoryTile({ memory }: { memory: Memory }) {
  return (
    <Link to={memoryHref(memory.id)} className="group focus-visible:ring-ring flex min-w-0 flex-col gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:outline-none" aria-label={`${memory.title}, ${formatHuman(memory.date)}`}>
      <div className="bg-muted aspect-square w-full overflow-hidden rounded-lg border">
        <MemoryPhoto body={memory.body} className="size-full" onMissing={() => <TitleOnly title={memory.title} />} />
      </div>
      <div className="min-w-0 px-0.5">
        <div className="line-clamp-2 text-sm font-medium break-words">{memory.title}</div>
        <div className="text-muted-foreground text-xs">{formatHuman(memory.date)}</div>
      </div>
    </Link>
  );
}

/**
 * The Memories place of the Journal (ADR 0136): every Memory as a tile, the
 * newest date first — two columns on a phone.
 */
export function MemoriesScreen() {
  const memories = useDocuments<Memory>(MEMORY);
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => newestFirst(memories), [memories]);
  // On a phone the add sits in the dock above the Phone bar, not in the title row.
  const add = (className?: string) => (
    <Button className={className} onClick={() => setAdding(true)}>
      <Plus /> New memory
    </Button>
  );
  return (
    <Page width="wide">
      <PageHeader title="Memories">{shown.length > 0 ? add("max-md:hidden") : null}</PageHeader>
      {shown.length === 0 ? (
        <EmptyState action={add()}>
          <Images className="mx-auto mb-2 size-5" /> The moments worth keeping: a photo, a few words, what it was about. Keep the first one.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((m) => (
            <li key={m.id} className="min-w-0">
              <MemoryTile memory={m} />
            </li>
          ))}
        </ul>
      )}
      {shown.length > 0 && <PhoneDock>{add("md:hidden")}</PhoneDock>}
      <NewMemoryDialog open={adding} onOpenChange={setAdding} />
    </Page>
  );
}
