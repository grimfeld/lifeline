import type { CardProps } from "@lifeline/core";
import { toast } from "@lifeline/ui";
import { Check } from "lucide-react";
import { mediaType } from "../domain/mediaTypes";
import { acquire, shoppingList } from "../domain/rules";
import { byMedium } from "../domain/cardQueries";
import { patchMedia, useMedia } from "../data/repo";
import { mediumOf } from "./shared";

/** Card: Wanted items holding a slot — the instruction to buy them. */
export function ShoppingListCard({ settings }: CardProps) {
  const items = useMedia();
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
              void patchMedia(m, acquire("OWNED"));
              toast.success(`${m.title} — owned`);
            }}
          >
            <Check className="size-3" />
          </button>
          <span className="truncate text-sm">{m.title}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{mediaType(m.type).label}</span>
        </li>
      ))}
    </ul>
  );
}
