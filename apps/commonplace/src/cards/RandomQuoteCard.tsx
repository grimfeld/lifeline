import { useEffect, useState } from "react";
import type { CardProps } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Dices } from "lucide-react";
import { pickIndex } from "../domain/works";
import { BigQuote } from "../components/BigQuote";
import { useQuotePool } from "./quoteShared";

/** Card: one random quote from the pool; reroll. */
export function RandomQuoteCard({ settings }: CardProps) {
  const { pool, byId } = useQuotePool(settings);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const currentIndex = pool.findIndex((q) => q.id === pickedId);
  const pick = currentIndex >= 0 ? pool[currentIndex] : undefined;
  useEffect(() => {
    if (!pick && pool.length > 0) setPickedId(pool[pickIndex(pool.length, null)].id);
  }, [pick, pool]);
  if (!pick) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No quotes yet.</div>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <BigQuote quote={pick} item={byId.get(pick.mediaId)} className="flex-1" />
      <div className="flex shrink-0 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setPickedId(pool[pickIndex(pool.length, currentIndex)].id)} disabled={pool.length < 2}>
          <Dices /> Reroll
        </Button>
      </div>
    </div>
  );
}
