import { useEffect, useState, type KeyboardEvent } from "react";
import { cn, Input, Label } from "@lifeline/ui";
import { todayStr, type PeekProps } from "@lifeline/core";
import { Minus, Plus } from "lucide-react";
import type { Provision } from "../domain/types";
import { clampQty, DEFAULT_EXPIRY_WINDOW_DAYS, expiresSoon, isExpired, isRunningLow } from "../domain/rules";
import { adjustQuantity, normalizeProvision, patchProvision } from "../data/repo";
import { HandOffMenu } from "./HandOffMenu";
import { Step } from "./ProvisionRow";
import { StorageSelect } from "./StorageSelect";

/** A typed value held while it is typed, following the Document whenever it changes underneath. */
function useTyped(saved: string) {
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  return [value, setValue] as const;
}

/**
 * Pantry's editable Peek (ADR 0085): a Provision peeked from anywhere — a
 * Base, a recipe's mention — counted with the row's own steppers, moved to
 * another Storage, its unit, minimum and dates set in place, and handed off
 * to a list when it runs low. Typed values are written when the field is
 * left (or on Enter); picks and dates at once.
 */
export function ProvisionPeek({ doc }: PeekProps) {
  const p = normalizeProvision(doc as Provision);
  const today = todayStr();
  const low = isRunningLow(p);
  const expired = isExpired(p, today);
  const soon = !expired && expiresSoon(p, today, DEFAULT_EXPIRY_WINDOW_DAYS);
  const [unit, setUnit] = useTyped(p.unit);
  const [minimum, setMinimum] = useTyped(p.minimum > 0 ? String(p.minimum) : "");

  const saveUnit = () => unit.trim() !== p.unit && void patchProvision(p.id, { unit: unit.trim() });
  const saveMinimum = () => {
    const n = clampQty(Number(minimum) || 0);
    if (n !== p.minimum) void patchProvision(p.id, { minimum: n });
  };
  const onEnter = (save: () => unknown) => (e: KeyboardEvent) => e.key === "Enter" && save();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <Step label="One fewer" icon={Minus} disabled={p.quantity <= 0} onClick={() => void adjustQuantity(p, -1)} />
        <span className={cn("min-w-7 text-center text-2xl font-semibold tabular-nums", p.quantity === 0 ? "text-destructive" : low && "text-warning")}>{p.quantity}</span>
        <Step label="One more" icon={Plus} onClick={() => void adjustQuantity(p, +1)} />
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">{p.unit || "in stock"}</span>
        {low ? <HandOffMenu handoff={() => ({ title: p.title, text: p.unit })} /> : null}
      </div>
      {expired ? <p className="text-destructive text-xs">Expired {p.expires}</p> : soon ? <p className="text-warning text-xs">Check by {p.expires}</p> : null}
      <div className="grid gap-1.5">
        <Label htmlFor="peek-pantry-storage">Storage</Label>
        <StorageSelect id="peek-pantry-storage" value={p.storageId} onChange={(storageId) => void patchProvision(p.id, { storageId })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="peek-pantry-unit">Unit</Label>
          <Input id="peek-pantry-unit" value={unit} onChange={(e) => setUnit(e.target.value)} onBlur={saveUnit} onKeyDown={onEnter(saveUnit)} placeholder="500g pack" />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="peek-pantry-min">Minimum</Label>
          <Input id="peek-pantry-min" type="number" min={0} step={1} value={minimum} onChange={(e) => setMinimum(e.target.value)} onBlur={saveMinimum} onKeyDown={onEnter(saveMinimum)} placeholder="none" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="peek-pantry-expires">Expires (check by)</Label>
          <Input id="peek-pantry-expires" type="date" value={p.expires} onChange={(e) => void patchProvision(p.id, { expires: e.target.value })} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="peek-pantry-frozen">Frozen on</Label>
          <Input id="peek-pantry-frozen" type="date" value={p.frozenOn} onChange={(e) => void patchProvision(p.id, { frozenOn: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
