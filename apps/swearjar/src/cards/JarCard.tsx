import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { SWEARJAR_HREF } from "../domain/types";
import { activeOffences, finesIn, jarTotal, monthKeyOf, monthLabel } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useFines, useOffences } from "../data/repo";
import { OffenceButton } from "../components/OffenceButton";
import { FineDialog } from "../components/FineDialog";

/**
 * The jar (ADR 0083): this month's total, and every Offence one tap away —
 * the phone-home glance and the fastest way to own up. Hold a button for
 * the details form.
 */
export function JarCard(_props: CardProps) {
  const navigate = useNavigate();
  const offences = useOffences();
  const fines = useFines();
  const month = monthKeyOf(new Date().toISOString());
  const active = useMemo(() => activeOffences(offences), [offences]);
  const monthFines = useMemo(() => finesIn(fines, month), [fines, month]);
  const total = jarTotal(monthFines);
  const [detailsFor, setDetailsFor] = useState<string | undefined>();

  return (
    <div className="grid h-full content-start gap-2 overflow-y-auto p-2">
      <button className="hover:bg-accent/50 flex items-baseline justify-between gap-2 rounded-sm px-1 text-left" onClick={() => navigate(SWEARJAR_HREF)} title="Open the Swear Jar">
        <span className="text-muted-foreground truncate text-xs">{monthLabel(month)}</span>
        <span className={cn("text-xl font-semibold tabular-nums", total > 0 && "text-destructive")}>{formatCents(total)}</span>
      </button>
      {active.length === 0 ? (
        <button className="text-muted-foreground text-sm" onClick={() => navigate(SWEARJAR_HREF)}>
          No offences yet — open the Swear Jar.
        </button>
      ) : (
        <div className="grid gap-1">
          {active.map((o) => (
            <OffenceButton key={o.id} offence={o} onDetails={() => setDetailsFor(o.id)} compact />
          ))}
        </div>
      )}
      <FineDialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(undefined)} offenceId={detailsFor} />
    </div>
  );
}
