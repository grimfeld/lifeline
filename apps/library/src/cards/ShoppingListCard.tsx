import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { toast } from "@lifeline/ui";
import { Check, ShoppingCart } from "lucide-react";
import { workType } from "../domain/workTypes";
import { acquire, isBuySignal, shoppingList } from "../domain/rules";
import { byMedium } from "../domain/cardQueries";
import { patchWork, useWorks } from "../data/repo";
import { mediumOf } from "./shared";

/** Card: everything Wanted — slotted ones first (buy now), then the rest of the wish list. */
export function ShoppingListCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const list = shoppingList(byMedium(items, mediumOf(settings)));
  if (list.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing to buy.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((m) => (
        <li key={m.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <button
            className="hover:bg-accent flex size-6 shrink-0 items-center justify-center rounded-full border"
            title="Got it"
            onClick={() => {
              void patchWork(m, acquire("OWNED"));
              toast.success(`${m.title} — owned`);
            }}
          >
            <Check className="size-3" />
          </button>
          <span className="truncate text-sm">{m.title}</span>
          {isBuySignal(m) && <ShoppingCart className="text-primary size-3.5 shrink-0" aria-label="Next up — buy now" />}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{workType(m.type).label}</span>
        </li>
      ))}
    </ul>
  );
}
