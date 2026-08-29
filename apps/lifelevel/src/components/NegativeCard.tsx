import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@lifeline/ui";
import type { ComputedNegativeState } from "../domain/types";
import { logNegative } from "../data/repo";
import { mournNegative } from "../feedback/feedback";

/**
 * One Negative activity: gravity, its target, one-tap log. Logging is blocked
 * — never a whiff — when there is no Habit to hit or the fixed rival is gone.
 */
export function NegativeCard({
  state,
  rivalTitle,
  rivalMissing,
  noHabits,
  onOpen,
}: {
  state: ComputedNegativeState;
  /** Title of the fixed rival, when paired and alive. */
  rivalTitle?: string;
  /** Fixed mode but the rival Habit was deleted: blocked until re-paired. */
  rivalMissing: boolean;
  /** No Habits exist at all: nothing to hit. */
  noHabits: boolean;
  onOpen: () => void;
}) {
  const [pending, setPending] = useState(false);
  const blocked = rivalMissing || noHabits;

  async function quickLog() {
    setPending(true);
    try {
      const r = await logNegative(state.negativeId);
      if (r?.ok) {
        mournNegative({ negativeTitle: r.negative.title, victimTitle: r.victim.title, victimId: r.victim.id, damage: r.damage });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={cn("gap-2 border-dashed", blocked && "opacity-75")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-1">
        <CardTitle className="min-w-0 text-base">
          <button type="button" className="block max-w-full truncate text-left hover:underline" onClick={onOpen}>
            {state.name}
          </button>
        </CardTitle>
        <Badge variant="destructive">{state.gravity}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-muted-foreground text-xs">
          {state.completionCount > 0 ? `Logged ${state.completionCount}× · ` : ""}
          {rivalMissing
            ? "Rival habit is gone — re-pair (or go random) before logging"
            : noHabits
              ? "No habit to hit — create a habit first"
              : state.affectsHabitId
                ? `undoes ${rivalTitle ?? "?"}`
                : "hits a random habit each log"}
        </p>
        <div>
          <Button size="sm" variant="outline" disabled={pending || blocked} onClick={() => void quickLog()}>
            {pending ? "Logging…" : "It happened"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
