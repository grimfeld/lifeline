import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

/**
 * The UI half of Push (ADR 0054): the "how long?" prompt and the toast with
 * Undo. Core does the finding and the writing; callers hand this a `run`
 * that calls it, so the UI package stays free of Core.
 */

/** Quick picks for an Estimate, in minutes. */
export const ESTIMATE_PICKS = [15, 30, 45, 60, 90, 120];

/** 45 → "45m", 60 → "1h", 90 → "1h 30m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Quick picks plus free entry for an Estimate; null = none. */
export function EstimatePicker({
  value,
  onChange,
  id,
}: {
  value: number | null;
  onChange: (min: number | null) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ESTIMATE_PICKS.map((m) => (
        <Button
          key={m}
          type="button"
          size="sm"
          variant={value === m ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(value === m ? null : m)}
        >
          {formatMinutes(m)}
        </Button>
      ))}
      <Input
        id={id}
        type="number"
        min={1}
        step={5}
        inputMode="numeric"
        placeholder="min"
        className={cn("h-7 w-20 text-xs")}
        value={value ?? ""}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
      />
    </div>
  );
}

/** What Core's push hands back — structurally, so this package need not import it. */
export interface PushOutcome {
  date: string;
  start: string;
  end: string;
  moved: boolean;
  undo(): Promise<void>;
}

export interface PushRequest {
  title: string;
  /** The item's Estimate; when absent, the flow asks for one first. */
  estimateMin?: number | null;
  /** Does the push; `estimateMin` is the answer to the prompt, when there was one. */
  run(estimateMin?: number): Promise<PushOutcome | null>;
}

function describeOutcome(o: PushOutcome): string {
  const day = new Date(`${o.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${day} ${o.start}–${o.end}`;
}

async function perform(req: PushRequest, estimateMin?: number): Promise<void> {
  try {
    const outcome = await req.run(estimateMin);
    if (!outcome) {
      toast.error("Nothing free in the next 2 weeks");
      return;
    }
    toast.success(`Pushed to ${describeOutcome(outcome)}`, {
      action: { label: "Undo", onClick: () => void outcome.undo() },
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

/**
 * `push(request)` runs Push, asking for an Estimate first when the item has
 * none (the answer is kept by the owning App). Render `dialog` once.
 */
export function usePushFlow(): { push: (req: PushRequest) => void; dialog: ReactElement } {
  const [asking, setAsking] = useState<PushRequest | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  const push = (req: PushRequest) => {
    if (req.estimateMin && req.estimateMin > 0) void perform(req);
    else {
      setMinutes(null);
      setAsking(req);
    }
  };

  const confirm = () => {
    if (!asking || !minutes) return;
    void perform(asking, minutes);
    setAsking(null);
  };

  const dialog = (
    <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How long will "{asking?.title}" take?</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <EstimatePicker value={minutes} onChange={setMinutes} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!minutes}>
              Push
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { push, dialog };
}
