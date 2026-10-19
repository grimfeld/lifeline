import { useEffect, useState } from "react";
import { Button, Input, Label } from "@lifeline/ui";
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
  const [note, setNote] = useState(need.note);
  useEffect(() => setNote(need.note), [need.note]);
  const saveNote = () => note.trim() !== need.note && void patchNeed(need.id, { note });

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
      <div className="grid gap-1.5">
        <Label htmlFor="peek-need-note">Note</Label>
        <Input
          id="peek-need-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => e.key === "Enter" && saveNote()}
          placeholder="2 L, the blue one…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="peek-need-aisle">Aisle</Label>
        <AisleSelect id="peek-need-aisle" value={need.aisleId} onChange={(aisleId) => void patchNeed(need.id, { aisleId })} className="w-full min-w-0" />
      </div>
    </div>
  );
}
