import { useState } from "react";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import type { Need } from "../domain/types";
import { useAisles, useNeeds } from "../data/repo";
import { NeedList } from "../components/NeedList";
import { NeedDialog } from "../components/NeedDialog";

/** Card: the Shopping list itself, tickable — the phone Screen held open in the shop. */
export function ShoppingListCard(_: CardProps) {
  const filter = useTagFilter();
  const needs = useNeeds().filter((n) => matchesTagFilter(n.tags, filter));
  const aisles = useAisles();
  const [editing, setEditing] = useState<Need | null>(null);
  return (
    <div className="h-full overflow-y-auto">
      <NeedList needs={needs} aisles={aisles} onOpen={setEditing} />
      <NeedDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} need={editing} />
    </div>
  );
}
