import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { LengthPicker } from "../ui/length-picker";

/**
 * The UI half of Push (ADR 0054): the "how long?" prompt and the toast with
 * Undo. Core does the finding and the writing; callers hand this a `run`
 * that calls it, so the UI package stays free of Core.
 */

/** An Estimate: a Length picker whose "none" leaves the item without one. */
export function EstimatePicker({
  value,
  onChange,
  id,
}: {
  value: number | null;
  onChange: (min: number | null) => void;
  id?: string;
}) {
  return <LengthPicker clearable aria-label="Estimate" id={id} value={value} onChange={onChange} />;
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

/** One toast for every Push: each replaces the last, so only the newest Undo is live — an older one would undo a state already moved on. */
const TOAST_ID = "push";

async function perform(req: PushRequest, estimateMin?: number): Promise<void> {
  try {
    const outcome = await req.run(estimateMin);
    if (!outcome) {
      toast.error("Nothing free in the next 2 weeks", { id: TOAST_ID });
      return;
    }
    toast.success(`Pushed to ${describeOutcome(outcome)}`, {
      id: TOAST_ID,
      action: { label: "Undo", onClick: () => void outcome.undo() },
    });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e), { id: TOAST_ID });
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
          <LengthPicker aria-label="Estimate" value={minutes} onChange={setMinutes} />
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
