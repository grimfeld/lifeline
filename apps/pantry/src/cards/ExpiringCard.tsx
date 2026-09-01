import { useMemo } from "react";
import { matchesTagFilter, todayStr, useTagFilter, type CardProps } from "@lifeline/core";
import { DEFAULT_EXPIRY_WINDOW_DAYS, expiring } from "../domain/rules";
import { useProvisions, useStorages } from "../data/repo";
import { ProvisionRow } from "../components/ProvisionRow";

/** Card: Provisions to check by their expires hint, soonest first. */
export function ExpiringCard({ settings }: CardProps) {
  const windowDays = typeof settings.window === "number" ? settings.window : DEFAULT_EXPIRY_WINDOW_DAYS;
  const filter = useTagFilter();
  const provisions = useProvisions().filter((p) => p.quantity > 0 && matchesTagFilter(p.tags, filter));
  const storages = useStorages();
  const names = useMemo(() => new Map(storages.map((s) => [s.id, s.title])), [storages]);
  const soon = expiring(provisions, todayStr(), windowDays);
  if (soon.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing to check.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {soon.map((p) => (
        <ProvisionRow key={p.id} p={p} storageName={names.get(p.storageId)} />
      ))}
    </ul>
  );
}
