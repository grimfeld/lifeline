import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { Layers, Play } from "lucide-react";
import { dueAhead, practiceQueue, retention } from "../domain/practice";
import type { Deck, Topic, Recall } from "../domain/types";
import type { MaterialDoc } from "../data/repo";
import { PracticeRun } from "../components/PracticeRun";

/** What a Deck holds that still exists — a deleted Word simply leaves every Deck. */
export function deckItems<T extends { id: string }>(deck: Deck, items: T[]): T[] {
  const ids = new Set(deck.members);
  return items.filter((i) => ids.has(i.id));
}

/**
 * The Knowledge home (CONTEXT.md "Practice", "Retention"): what is due and
 * new, one tap into a Practice of the whole Topic or of one Deck, then the
 * two readings — Retention and the week ahead. No streak, no score.
 */
export function PracticeTab({ topic, items, decks, recalls }: { topic: Topic; items: MaterialDoc[]; decks: Deck[]; recalls: Recall[] }) {
  const [running, setRunning] = useState<{ deck?: Deck } | null>(null);
  const now = useMemo(() => new Date(), [recalls]); // re-read the clock whenever practice changes something
  const live = useMemo(() => items.filter((i) => i.live), [items]);
  const q = useMemo(() => practiceQueue(live, recalls, { now, newCap: topic.newCap }), [live, recalls, now, topic.newCap]);
  const ret = useMemo(() => retention(recalls, now), [recalls, now]);
  const week = useMemo(() => dueAhead(live, recalls, now), [live, recalls, now]);
  const peak = Math.max(1, ...week.map((d) => d.count));

  if (running) {
    return <PracticeRun topic={topic} items={running.deck ? deckItems(running.deck, items) : items} recalls={recalls} deckName={running.deck?.name} onDone={() => setRunning(null)} />;
  }

  const ready = q.due + q.newToday;

  return (
    <div className="grid gap-4">
      <Card className="py-0">
        <CardContent className="grid justify-items-center gap-3 px-4 py-8 text-center">
          <span className="text-4xl font-semibold tabular-nums">{ready}</span>
          <span className="text-muted-foreground text-sm">
            {q.due} due · {q.newToday} new today{q.newWaiting > q.newToday ? ` · ${q.newWaiting - q.newToday} more new waiting` : ""}
          </span>
          <Button size="lg" className="mt-1 h-12 max-w-full px-8 text-base" onClick={() => setRunning({})} disabled={items.length === 0}>
            <Play /> <span className="truncate">Practise {topic.name}</span>
          </Button>
          {items.length === 0 && <span className="text-muted-foreground text-xs">Add a word or a sentence you met to begin.</span>}
        </CardContent>
      </Card>

      {decks.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Decks</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {decks.map((d) => {
              const di = deckItems(d, live);
              const dq = practiceQueue(di, recalls, { now, newCap: topic.newCap });
              return (
                <button key={d.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-60" onClick={() => setRunning({ deck: d })} disabled={di.length === 0}>
                  <Layers className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {dq.due} due{dq.newToday ? ` · ${dq.newToday} new` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <section className="grid content-start gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Retention</h2>
          <Card className="py-0">
            <CardContent className="grid gap-0.5 px-4 py-3">
              <span className="text-2xl font-semibold tabular-nums">{ret ? `${Math.round(ret.share * 100)}%` : "—"}</span>
              <span className="text-muted-foreground text-xs">{ret ? `${ret.passed} of ${ret.total} recalls passed, last 30 days` : "Not enough recalls yet"}</span>
            </CardContent>
          </Card>
        </section>
        <section className="grid content-start gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">The week ahead</h2>
          <Card className="py-0">
            <CardContent className="grid grid-cols-7 items-end gap-1.5 px-3 py-3">
              {week.map((d, i) => (
                <div key={d.day} className="grid justify-items-center gap-1" title={`${formatHuman(d.day)} · ${d.count} due`}>
                  <span className="text-muted-foreground text-[10px] tabular-nums">{d.count || ""}</span>
                  <div className={cn("w-full rounded-sm", i === 0 ? "bg-primary" : "bg-primary/40")} style={{ height: `${4 + (d.count / peak) * 44}px` }} />
                  <span className="text-muted-foreground text-[10px]">{i === 0 ? "Today" : new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
