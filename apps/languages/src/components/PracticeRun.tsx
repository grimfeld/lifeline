import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, toast } from "@lifeline/ui";
import { Check, Eye, X } from "lucide-react";
import { practiceQueue, type HeldPrompt } from "../domain/practice";
import type { Grade, Item, Language, Recall } from "../domain/types";
import { recordRecall, strikeRecall } from "../data/repo";
import { PromptFace } from "./PromptFace";

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
export function PracticeRun({ language, items, recalls, deckName, onDone }: { language: Language; items: Item[]; recalls: Recall[]; deckName?: string; onDone: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState<{ key: string; id: string } | null>(null);
  const [lastItem, setLastItem] = useState("");
  const [count, setCount] = useState({ passed: 0, failed: 0 });
  // Set before the Recall is written and cleared by the next reveal: a double tap grades once.
  const graded = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // A Recall just written is not in `recalls` until the live query catches up; hold its Prompt back until then.
  useEffect(() => {
    if (pending && recalls.some((r) => r.id === pending.id)) setPending(null);
  }, [recalls, pending]);

  const live = useMemo(() => items.filter((i) => !i.paused), [items]);
  const q = useMemo(() => practiceQueue(live, recalls, { now, newCap: language.newCap }), [live, recalls, now, language.newCap]);
  const candidates = q.queue.filter((p) => p.key !== pending?.key);
  const current: HeldPrompt | undefined = candidates.find((p) => p.itemId !== lastItem) ?? candidates[0];
  const item = current ? live.find((i) => i.id === current.itemId) : undefined;

  function reveal() {
    graded.current = false;
    setRevealed(true);
  }

  async function grade(g: Grade) {
    if (!current || !item || !revealed || graded.current) return;
    graded.current = true;
    const key = current.key;
    let r: Awaited<ReturnType<typeof recordRecall>>;
    try {
      r = await recordRecall(item, current.slot, g);
    } catch (e) {
      graded.current = false;
      toast.error((e as Error).message);
      return;
    }
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
        if (!revealed) reveal();
      } else if (revealed && (e.key === "1" || e.key.toLowerCase() === "f")) void grade("fail");
      else if (revealed && (e.key === "2" || e.key.toLowerCase() === "j")) void grade("pass");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const done = count.passed + count.failed;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <span>
          {language.name}
          {deckName ? ` · ${deckName}` : ""} · {q.due} due · {q.newToday} new
        </span>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Stop
        </Button>
      </div>

      {current && item ? (
        <>
          <Card className="min-h-72 py-0">
            <CardContent className="grid min-h-72 place-items-center px-6 py-10">
              <PromptFace item={item} slot={current.slot} revealed={revealed} />
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
            <Button size="lg" variant="secondary" className="h-14 text-base" onClick={reveal}>
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
