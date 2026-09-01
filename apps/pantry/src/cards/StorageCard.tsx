import { matchesTagFilter, useTagFilter, type CardProps, type CardSettings } from "@lifeline/core";
import { provisionsIn } from "../domain/rules";
import { useProvisions, useStorages } from "../data/repo";
import { ProvisionRow } from "../components/ProvisionRow";

/** Instance title: the chosen Storage's name, live. */
export function useStorageCardTitle(settings: CardSettings): string {
  const storages = useStorages();
  const s = storages.find((x) => x.id === settings.storage);
  return s ? s.title : "Storage";
}

/** Card: one Storage's shelfful with steppers — the chest freezer on the home screen. */
export function StorageCard({ settings, configure }: CardProps) {
  const filter = useTagFilter();
  const storages = useStorages();
  const storage = storages.find((s) => s.id === settings.storage);
  const provisions = useProvisions().filter((p) => matchesTagFilter(p.tags, filter));
  if (!storage) {
    return (
      <button type="button" className="text-muted-foreground hover:text-foreground flex h-full w-full items-center justify-center text-sm" onClick={configure}>
        Choose a storage…
      </button>
    );
  }
  const list = provisionsIn(provisions, storage.id);
  if (list.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">{storage.title} is empty.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {list.map((p) => (
        <ProvisionRow key={p.id} p={p} />
      ))}
    </ul>
  );
}
