import { useState } from "react";
import { Button } from "@lifeline/ui";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import type { Aisle, Need } from "../domain/types";
import { isListed } from "../domain/rules";
import { shiftAisle, useAisles, useNeeds } from "../data/repo";
import { NeedList } from "../components/NeedList";
import { AddNeedDialog } from "../components/AddNeedDialog";
import { NeedDialog } from "../components/NeedDialog";
import { AisleDialog } from "../components/AisleDialog";

function IconButton({ title, icon: Icon, onClick, disabled }: { title: string; icon: typeof Plus; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" title={title} disabled={disabled} onClick={onClick}>
      <Icon className="size-3.5" />
    </button>
  );
}

/** The Shopping list (ADR 0055): what to buy at the next chance, walked Aisle by Aisle. */
export function ShoppingScreen() {
  const needs = useNeeds();
  const aisles = useAisles();
  const [adding, setAdding] = useState<{ aisleId: string } | null>(null);
  const [editing, setEditing] = useState<Need | null>(null);
  const [aisleOpen, setAisleOpen] = useState(false);
  const [editingAisle, setEditingAisle] = useState<Aisle | null>(null);

  const listed = needs.filter(isListed).length;

  function openAisle(a: Aisle | null) {
    setEditingAisle(a);
    setAisleOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">
          Shopping list <span className="text-muted-foreground text-sm font-normal">{listed}</span>
        </h1>
        <Button type="button" variant="outline" onClick={() => openAisle(null)}>
          New aisle
        </Button>
        <Button type="button" onClick={() => setAdding({ aisleId: "" })}>
          <Plus className="size-4" /> Need
        </Button>
      </div>

      <NeedList
        needs={needs}
        aisles={aisles}
        onOpen={setEditing}
        showEmptyAisles
        aisleHeader={(a) => {
          const i = aisles.findIndex((x) => x.id === a.id);
          return (
            <>
              <IconButton title="Earlier in the walk" icon={ChevronUp} disabled={i <= 0} onClick={() => void shiftAisle(aisles, a.id, -1)} />
              <IconButton title="Later in the walk" icon={ChevronDown} disabled={i >= aisles.length - 1} onClick={() => void shiftAisle(aisles, a.id, 1)} />
              <IconButton title="Edit aisle" icon={Pencil} onClick={() => openAisle(a)} />
              <IconButton title="Add here" icon={Plus} onClick={() => setAdding({ aisleId: a.id })} />
            </>
          );
        }}
      />

      <AddNeedDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} defaultAisleId={adding?.aisleId} />
      <NeedDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} need={editing} />
      <AisleDialog open={aisleOpen} onOpenChange={setAisleOpen} aisle={editingAisle} />
    </div>
  );
}
