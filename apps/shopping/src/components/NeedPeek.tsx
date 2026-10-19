import { Button, CommitField, Field } from "@lifeline/ui";
import { formatHuman, type PeekProps } from "@lifeline/core";
import { Check, Undo2 } from "lucide-react";
import type { Need } from "../domain/types";
import { markBought, normalizeNeed, patchNeed, unmarkBought } from "../data/repo";
import { AisleSelect } from "./AisleSelect";

/**
 * Shopping's editable Peek (ADR 0085): a Need peeked from anywhere — a Base,
 * the Vault — ticked bought or put back on the list, its note and Aisle set in
 * place. The note is written when the field is left (or on Enter), the Aisle
 * at once. The title stays with the Need's dialog, which refuses renaming one
 * Need onto another.
 */
export function NeedPeek({ doc }: PeekProps) {
  const need = normalizeNeed(doc as Need);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {need.boughtOn ? (
          <>
            <span className="text-muted-foreground text-sm">Bought {formatHuman(need.boughtOn)}</span>
            <Button size="sm" variant="outline" onClick={() => void unmarkBought(need.id)}>
              <Undo2 /> Put back on list
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground text-sm">On the list</span>
            <Button size="sm" onClick={() => void markBought(need.id)}>
              <Check /> Mark bought
            </Button>
          </>
        )}
      </div>
      <CommitField label="Note" value={need.note} placeholder="2 L, the blue one…" onCommit={(note) => note.trim() !== need.note && patchNeed(need.id, { note })} />
      <Field label="Aisle">
        <AisleSelect value={need.aisleId} onChange={(aisleId) => void patchNeed(need.id, { aisleId })} className="w-full min-w-0" />
      </Field>
    </div>
  );
}
