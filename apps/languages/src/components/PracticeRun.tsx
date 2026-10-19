import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, toast } from "@lifeline/ui";
import { recallableDef } from "@lifeline/core";
import { Check, Eye, X } from "lucide-react";
import { practiceQueue, type HeldPrompt, type NewCap } from "../domain/practice";
import type { Grade, Recall } from "../domain/types";
import { recordRecall, strikeRecall, type MaterialDoc } from "../data/repo";

function whenLabel(d: Date, now: Date): string {
  const mins = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (mins < 60) return `in ${Math.max(1, mins)} min`;
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `at ${time}`;
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/**
 * A Practice (CONTEXT.md "Practice"): one Prompt at a time — recall it, reveal,
 * grade yourself pass or fail. The queue is re-read from the Recalls after
 * every grade, so a failed Prompt comes back within the sitting and stopping
 * halfway loses nothing. The last grade can be undone: the Recall is struck.
 */
export function PracticeRun({ label, items, recalls, newCap, onDone }: {
  /** What this Practice covers, as its header says it: "Spanish · Kitchen", "Everything". */
  label: string;
  items: MaterialDoc[];
  /** Every Recall of each Topic it touches — the cap counts across the whole Topic. */
  recalls: Recall[];
  newCap: NewCap;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState<{ key: string; id: string } | null>(null);
  const [lastItem, setLastItem] = useState("");
  const [count, setCount] = useState({ passed: 0, failed: 0 });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // A Recall just written is not in `recalls` until the live query catches up; hold its Prompt back until then.
  useEffect(() => {
    if (pending && recalls.some((r) => r.id === pending.id)) setPending(null);
  }, [recalls, pending]);

  const live = useMemo(() => items.filter((i) => i.live), [items]);
  const q = useMemo(() => practiceQueue(live, recalls, { now, newCap }), [live, recalls, now, newCap]);
  const candidates = q.queue.filter((p) => p.key !== pending?.key);
  const current: HeldPrompt | undefined = candidates.find((p) => p.itemId !== lastItem) ?? candidates[0];
  const item = current ? live.find((i) => i.id === current.itemId) : undefined;
  // Each Prompt is drawn by the App that owns its Document (ADR 0073).
  const Face = item ? recallableDef(item.type)?.face : undefined;

  async function grade(g: Grade) {
    if (!current || !item || !revealed) return;
    const key = current.key;
    const r = await recordRecall(item, current.slot, g);
    setPending({ key, id: r.id });
    setLastItem(item.id);
    setRevealed(false);
    setNow(new Date());
    setCount((c) => (g === "pass" ? { ...c, passed: c.passed + 1 } : { ...c, failed: c.failed + 1 }));
    if (r.tallyError) toast.error(r.tallyError);
    toast(g === "pass" ? "Passed" : "Failed", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          void strikeRecall(r.id);
          setCount((c) => (g === "pass" ? { ...c, passed: c.passed - 1 } : { ...c, failed: c.failed - 1 }));
          setLastItem("");
        },
      },
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      } else if (revealed && (e.key === "1" || e.key.toLowerCase() === "f")) void grade("fail");
      else if (revealed && (e.key === "2" || e.key.toLowerCase() === "j")) void grade("pass");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const done = count.passed + count.failed;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {label} · {q.due} due · {q.newToday} new
        </span>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onDone}>
          Stop
        </Button>
      </div>

      {current && item && Face ? (
        <>
          <Card className="min-h-72 py-0">
            <CardContent className="grid min-h-72 place-items-center px-6 py-10">
              <Face doc={item.doc} slot={current.slot} revealed={revealed} />
            </CardContent>
          </Card>
          {revealed ? (
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => void grade("fail")}>
                <X /> Fail
              </Button>
              <Button size="lg" className="h-14 text-base" onClick={() => void grade("pass")}>
                <Check /> Pass
              </Button>
            </div>
          ) : (
            <Button size="lg" variant="secondary" className="h-14 text-base" onClick={() => setRevealed(true)}>
              <Eye /> Show answer
            </Button>
          )}
          <p className="text-muted-foreground hidden text-center text-xs md:block">Space to reveal · 1 or F to fail · 2 or J to pass</p>
        </>
      ) : (
        <Card className="py-0">
          <CardContent className="grid justify-items-center gap-2 px-6 py-10 text-center">
            <span className="text-lg font-semibold">{done ? "That's everything for now." : "Nothing to practise right now."}</span>
            {done > 0 && (
              <span className="text-muted-foreground text-sm">
                {done} recalled · {count.passed} passed
              </span>
            )}
            {q.nextAt && <span className="text-muted-foreground text-sm">Next one due {whenLabel(q.nextAt, now)}.</span>}
            {q.newWaiting > 0 && q.newToday === 0 && <span className="text-muted-foreground text-sm">{q.newWaiting} new waiting — today's new cap is used.</span>}
            <Button className="mt-2" onClick={onDone}>
              Back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
