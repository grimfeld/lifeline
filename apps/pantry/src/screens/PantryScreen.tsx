import { useMemo, useState } from "react";
import { Badge, Button, Input, PhoneDock, cn } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { Archive, Pencil, Plus, Refrigerator, Snowflake, TriangleAlert } from "lucide-react";
import type { Provision, Storage, StorageKind } from "../domain/types";
import { DEFAULT_EXPIRY_WINDOW_DAYS, expiring, provisionsIn, runningLow, unplaced } from "../domain/rules";
import { useProvisions, useStorages } from "../data/repo";
import { ProvisionRow } from "../components/ProvisionRow";
import { ProvisionDialog } from "../components/ProvisionDialog";
import { StorageDialog } from "../components/StorageDialog";
import { QuickAdd } from "../components/QuickAdd";

const KIND_ICONS: Record<StorageKind, typeof Snowflake> = { freezer: Snowflake, fridge: Refrigerator, shelf: Archive };

function StorageSection({ storage, list, onOpen, onEditStorage, onAddHere }: { storage: Storage; list: Provision[]; onOpen: (p: Provision) => void; onEditStorage: () => void; onAddHere: () => void }) {
  const Icon = KIND_ICONS[storage.kind];
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{storage.title}</h2>
        <span className="text-muted-foreground text-xs">{list.length}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit storage" onClick={onEditStorage}>
          <Pencil className="size-3.5" />
        </button>
        <button type="button" className="text-muted-foreground hover:text-foreground" title="Add here" onClick={onAddHere}>
          <Plus className="size-3.5" />
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-muted-foreground px-1 text-sm">Empty.</div>
      ) : (
        <ul className="grid gap-0.5">
          {list.map((p) => (
            <ProvisionRow key={p.id} p={p} onOpen={() => onOpen(p)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Pantry: the household's stocks, walked storage by storage (ADR 0043). */
export function PantryScreen() {
  const storages = useStorages();
  const provisions = useProvisions();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Provision | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [editingStorage, setEditingStorage] = useState<Storage | null>(null);

  const today = todayStr();
  const low = runningLow(provisions);
  const soon = useMemo(() => expiring(provisions.filter((p) => p.quantity > 0), today, DEFAULT_EXPIRY_WINDOW_DAYS), [provisions, today]);
  const orphans = unplaced(provisions, storages);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? provisions.filter((p) => p.title.toLowerCase().includes(q)) : provisions;
  }, [provisions, search]);

  function openProvision(p: Provision) {
    setEditing(p);
    setAddingIn(null);
    setProvisionOpen(true);
  }
  function addProvisionIn(storageId: string | null) {
    setEditing(null);
    setAddingIn(storageId);
    setProvisionOpen(true);
  }
  function openStorage(s: Storage | null) {
    setEditingStorage(s);
    setStorageOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">Pantry</h1>
        <PhoneDock row>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the stocks…" className="w-48 min-w-0 max-md:flex-1" />
          <Button type="button" variant="outline" onClick={() => openStorage(null)}>
            New storage
          </Button>
          <Button type="button" disabled={storages.length === 0} onClick={() => addProvisionIn(null)}>
            <Plus className="size-4" /> Provision
          </Button>
        </PhoneDock>
      </div>

      {(low.length > 0 || soon.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {low.length > 0 && (
            <Badge variant="outline" className={cn("gap-1", "border-amber-600/50 text-amber-600 dark:text-amber-500")}>
              <TriangleAlert className="size-3" /> {low.length} running low
            </Badge>
          )}
          {soon.length > 0 && (
            <Badge variant="outline" className="border-destructive/50 text-destructive gap-1">
              {soon.length} to check by date
            </Badge>
          )}
        </div>
      )}

      {storages.length > 0 && <QuickAdd />}

      {storages.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          The pantry starts with a place to put things.{" "}
          <button type="button" className="text-foreground underline" onClick={() => openStorage(null)}>
            Create your first storage
          </button>{" "}
          — a freezer, the fridge, a shelf.
        </div>
      ) : (
        <div className="grid gap-5">
          {storages.map((s) => (
            <StorageSection key={s.id} storage={s} list={provisionsIn(shown, s.id)} onOpen={openProvision} onEditStorage={() => openStorage(s)} onAddHere={() => addProvisionIn(s.id)} />
          ))}
          {orphans.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold">Unplaced</h2>
              <ul className="grid gap-0.5">
                {orphans
                  .filter((p) => shown.includes(p))
                  .map((p) => (
                    <ProvisionRow key={p.id} p={p} onOpen={() => openProvision(p)} />
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <ProvisionDialog open={provisionOpen} onOpenChange={setProvisionOpen} provision={editing} defaultStorageId={addingIn ?? undefined} />
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} storage={editingStorage} />
    </div>
  );
}
