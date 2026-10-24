import { cn, CommitField, Field } from "@lifeline/ui";
import { todayStr, type PeekProps } from "@lifeline/core";
import { Minus, Plus } from "lucide-react";
import type { Provision } from "../domain/types";
import { clampQty, DEFAULT_EXPIRY_WINDOW_DAYS, expiresSoon, isExpired, isRunningLow } from "../domain/rules";
import { adjustQuantity, normalizeProvision, patchProvision } from "../data/repo";
import { HandOffMenu } from "./HandOffMenu";
import { Step } from "./ProvisionRow";
import { StorageSelect } from "./StorageSelect";

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
  const saveUnit = (unit: string) => unit.trim() !== p.unit && patchProvision(p.id, { unit: unit.trim() });
  const saveMinimum = (typed: string) => {
    const n = clampQty(Number(typed) || 0);
    return n !== p.minimum ? patchProvision(p.id, { minimum: n }) : undefined;
  };

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
      <Field label="Storage">
        <StorageSelect value={p.storageId} onChange={(storageId) => void patchProvision(p.id, { storageId })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Unit" className="min-w-0" value={p.unit} placeholder="500g pack" onCommit={saveUnit} />
        <CommitField label="Minimum" className="min-w-0" type="number" min={0} step={1} value={p.minimum > 0 ? String(p.minimum) : ""} placeholder="none" onCommit={saveMinimum} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Expires (check by)" className="min-w-0" type="date" value={p.expires} onCommit={(expires) => patchProvision(p.id, { expires })} />
        <CommitField label="Frozen on" className="min-w-0" type="date" value={p.frozenOn} onCommit={(frozenOn) => patchProvision(p.id, { frozenOn })} />
      </div>
    </div>
  );
}
