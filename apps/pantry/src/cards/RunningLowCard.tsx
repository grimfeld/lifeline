import { useMemo } from "react";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { runningLow } from "../domain/rules";
import { useProvisions, useStorages } from "../data/repo";
import { ProvisionRow } from "../components/ProvisionRow";

/** Card: every Provision under its Minimum or out entirely — the restock reading. */
export function RunningLowCard(_: CardProps) {
  const filter = useTagFilter();
  const provisions = useProvisions().filter((p) => matchesTagFilter(p.tags, filter));
  const storages = useStorages();
  const names = useMemo(() => new Map(storages.map((s) => [s.id, s.title])), [storages]);
  const low = runningLow(provisions);
  if (low.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Stocked up.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {low.map((p) => (
        <ProvisionRow key={p.id} p={p} storageName={names.get(p.storageId)} />
      ))}
    </ul>
  );
}
