import { useEffect, useMemo, useState } from "react";
import type { CardProps } from "@lifeline/core";
import { Badge, Button, toast } from "@lifeline/ui";
import { ArrowDownToLine, Dices } from "lucide-react";
import { workType } from "../domain/workTypes";
import { freeSlots, promote } from "../domain/rules";
import { pickIndex, surprisePool } from "../domain/cardQueries";
import { patchWork, useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { mediumOf } from "./shared";

/** Card: one random owned-but-unstarted item from the backlog; reroll or slot it. */
export function SurpriseCard({ settings }: CardProps) {
  const items = useWorks();
  const medium = mediumOf(settings);
  const pool = useMemo(() => surprisePool(items, medium), [items, medium]);
  // Remember the pick by id so a live-query refresh does not silently reroll.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const currentIndex = pool.findIndex((m) => m.id === pickedId);
  const pick = currentIndex >= 0 ? pool[currentIndex] : undefined;
  // First pick, or re-pick when the current one left the pool (slotted, started, filtered out).
  useEffect(() => {
    if (!pick && pool.length > 0) setPickedId(pool[pickIndex(pool.length, null)].id);
  }, [pick, pool]);

  if (!pick) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing in the backlog to pick from.</div>;
  }
  const def = workType(pick.type);
  const free = freeSlots(items, pick.type);
  const reroll = () => setPickedId(pool[pickIndex(pool.length, currentIndex)].id);
  const toNightstand = () => {
    if (free.length === 0) return void toast.error(`The ${def.plural.toLowerCase()} nightstand is full`);
    void patchWork(pick, promote(free[0]));
    toast.success(`Slot ${free[0]} taken`);
  };
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2 overflow-y-auto text-center">
      <Cover item={pick} className={def.cover === "square" ? "size-28 text-xs" : "h-40 w-28 text-xs"} />
      <div className="min-w-0 w-full">
        <div className="line-clamp-2 text-sm font-medium leading-tight">{pick.title}</div>
        {pick.creator && <div className="text-muted-foreground truncate text-xs">{pick.creator}</div>}
        {pick.reason && <div className="text-muted-foreground mt-1 line-clamp-3 text-xs italic">{pick.reason}</div>}
        <Badge variant="outline" className="mt-1 text-[10px]">
          {def.label}
        </Badge>
      </div>
      <div className="mt-auto flex shrink-0 flex-wrap justify-center gap-1.5 pt-1">
        <Button size="sm" variant="outline" onClick={reroll} disabled={pool.length < 2}>
          <Dices /> Reroll
        </Button>
        <Button size="sm" onClick={toNightstand}>
          <ArrowDownToLine /> To Nightstand
        </Button>
      </div>
    </div>
  );
}
