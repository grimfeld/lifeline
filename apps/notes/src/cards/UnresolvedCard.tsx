import { useNavigate } from "react-router";
import { Button, toast } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { createDocument, docHref, useLinkIndex, type CardProps } from "@lifeline/core";
import { unresolvedEntries } from "../domain/mentions";
import { THOUGHT } from "../domain/types";

/** Card: [[links]] that resolve to nothing; "+" creates the note (knobs: count, sort). */
export function UnresolvedCard({ settings }: CardProps) {
  const count = Number(settings.count ?? 15);
  const sort = settings.sort === "name" ? "name" : "count";
  const index = useLinkIndex();
  const navigate = useNavigate();
  const list = unresolvedEntries(index, sort).slice(0, count);

  async function create(name: string) {
    try {
      const n = await createDocument({ type: THOUGHT, title: name });
      navigate(docHref(n));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create note");
    }
  }

  if (list.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Every link resolves ✨</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((e) => (
        <li key={e.name} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <span className="truncate text-sm">{e.name}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
            {e.noteIds.length} {e.noteIds.length === 1 ? "note" : "notes"}
          </span>
          <Button size="icon" variant="ghost" className="size-6 shrink-0" title={`Create "${e.name}"`} onClick={() => void create(e.name)}>
            <Plus className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
