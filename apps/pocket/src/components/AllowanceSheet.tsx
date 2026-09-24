import { Button, cn, Sheet, SheetContent, SheetTitle } from "@lifeline/ui";
import { formatHuman, useIsMobile } from "@lifeline/core";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { faceColor, faceOf, type Spend } from "../domain/types";
import { jarLevel, type AllowanceRow } from "../domain/derive";
import { periodLabel } from "../domain/period";
import { formatCents } from "../domain/money";
import { Jar } from "./Jar";

/**
 * One Allowance opened: what is left, its actions, its Spends. The same sheet
 * for every bucket — a Spend may be backdated into an ended Allowance — rising
 * from the bottom on a phone, from the side on a desk.
 */
export function AllowanceSheet({
  row,
  onOpenChange,
  renewable,
  onSpend,
  onEdit,
  onRenew,
  onEditSpend,
}: {
  row: AllowanceRow | undefined;
  onOpenChange: (open: boolean) => void;
  renewable: boolean;
  onSpend: () => void;
  onEdit: () => void;
  onRenew: () => void;
  onEditSpend: (s: Spend) => void;
}) {
  const isMobile = useIsMobile();
  const a = row?.allowance;
  const over = !!row && row.left < 0;
  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} aria-describedby={undefined} className="gap-3 p-4 sm:max-w-md">
        {row && a && (
          <>
            <div className="flex items-center gap-3 pr-2">
              <Jar level={jarLevel(row)} over={over} color={faceColor(a)} size="sm" className="h-10 w-[30px]" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2 p-0 text-base font-semibold">
                  <span className="leading-none">{faceOf(a)}</span>
                  <span className="truncate">{a.name}</span>
                </SheetTitle>
                <p className="text-muted-foreground text-xs">{periodLabel(a)}</p>
              </div>
              <div className="text-right">
                <div className={cn("text-lg font-semibold tabular-nums", over && "text-destructive")}>{formatCents(row.left)}</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {formatCents(row.spent)} / {formatCents(a.amount)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={onSpend}>
                <Plus /> Spend
              </Button>
              <Button variant="outline" onClick={onEdit}>
                <Pencil /> Edit
              </Button>
              {renewable && (
                <Button variant="outline" onClick={onRenew}>
                  <RefreshCw /> Renew
                </Button>
              )}
            </div>
            <SpendList spends={row.spends} onEditSpend={onEditSpend} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SpendList({ spends, onEditSpend }: { spends: Spend[]; onEditSpend: (s: Spend) => void }) {
  return (
    <div className="grid gap-0.5 border-t pt-2">
      {spends.length === 0 && <p className="text-muted-foreground px-2 py-1 text-sm">Nothing spent yet.</p>}
      {spends.map((s) => (
        <button key={s.id} className="hover:bg-accent/50 active:bg-accent/50 flex min-w-0 items-center gap-3 rounded-sm px-2 py-2 text-left text-sm" onClick={() => onEditSpend(s)}>
          <span className="text-muted-foreground w-24 shrink-0 text-xs">{formatHuman(s.date)}</span>
          <span className="min-w-0 flex-1 truncate">{s.label || <span className="text-muted-foreground">—</span>}</span>
          <span className="shrink-0 tabular-nums">{formatCents(s.amount)}</span>
        </button>
      ))}
    </div>
  );
}
