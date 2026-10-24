import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Card, CardContent, cn } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { BookOpen, Layers, Play, Shapes } from "lucide-react";
import { dueAheadOfHeld, heldPrompts, introducedByTopic, queueOfHeld, retention, type NewCap, type PracticeQueue } from "../domain/practice";
import type { Deck, Topic, Recall } from "../domain/types";
import { useAllMaterial, useRecalls, useSourceChains, useTopics, type MaterialDoc } from "../data/repo";
import { PracticeRun } from "../components/PracticeRun";

/** What a Deck holds that still exists — a deleted Word simply leaves every Deck. */
export function deckItems<T extends { id: string }>(deck: Deck, items: T[]): T[] {
  const ids = new Set(deck.members);
  return items.filter((i) => ids.has(i.id));
}

/** A Practice opened by link — the Due Card's "everything", one Source's, or the active Topic's (a Puzzle's "practise now"). */
const PRACTICE_PARAM = "practice";

/** How many Sources are listed before "show all". */
const SOURCES_SHOWN = 6;

type Run = { kind: "topic" } | { kind: "deck"; deck: Deck } | { kind: "all" } | { kind: "source"; id: string };

function runOf(param: string | null): Run | null {
  if (param === "all") return { kind: "all" };
  if (param === "topic") return { kind: "topic" };
  if (param?.startsWith("source:")) return { kind: "source", id: param.slice("source:".length) };
  return null;
}

/**
 * The Knowledge home (CONTEXT.md "Practice", "Retention"): what is due and
 * new, one tap into a Practice of the active Topic or of one of its Decks —
 * or of everything at once, each Topic's cap still holding, or of what was
 * kept from one Source — then the two readings, Retention and the week ahead.
 * No streak, no score.
 */
export function PracticeTab({ topic, items, decks, recalls }: { topic: Topic; items: MaterialDoc[]; decks: Deck[]; recalls: Recall[] }) {
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState<Run | null>(null);
  const running = runOf(params.get(PRACTICE_PARAM)) ?? local;
  const [allSources, setAllSources] = useState(false);

  // Everything: every live Topic's material, each Topic held to its own cap.
  const topics = useTopics();
  const allRecalls = useRecalls();
  const allMaterial = useAllMaterial();
  const liveTopics = useMemo(() => topics.filter((t) => !t.archived), [topics]);
  const capOf: NewCap = useMemo(() => {
    const caps = new Map(liveTopics.map((t) => [t.id, t.newCap]));
    return (t: string) => caps.get(t) ?? 0;
  }, [liveTopics]);
  const everything = useMemo(() => {
    const ids = new Set(liveTopics.map((t) => t.id));
    return allMaterial.filter((m) => ids.has(m.topicId));
  }, [allMaterial, liveTopics]);
  const { chains, titleOf } = useSourceChains(everything);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever practice changes something
  const now = useMemo(() => new Date(), [allRecalls]);
  const live = useMemo(() => items.filter((i) => i.live), [items]);
  const liveAll = useMemo(() => everything.filter((i) => i.live), [everything]);
  // The Recalls are replayed once per change; the Topic's queue, each Deck's, each Source's and the week ahead all read these.
  const held = useMemo(() => heldPrompts(live, recalls), [live, recalls]);
  const heldAll = useMemo(() => heldPrompts(liveAll, allRecalls), [liveAll, allRecalls]);
  const introduced = useMemo(() => introducedByTopic(allRecalls, todayStr(now)), [allRecalls, now]);
  const q = useMemo(() => queueOfHeld(held, introduced, { now, newCap: topic.newCap }), [held, introduced, now, topic.newCap]);
  const qAll = useMemo(() => queueOfHeld(heldAll, introduced, { now, newCap: capOf }), [heldAll, introduced, now, capOf]);
  const deckQueues = useMemo(() => {
    const out = new Map<string, PracticeQueue>();
    for (const d of decks) {
      const ids = new Set(d.members);
      out.set(d.id, queueOfHeld(held.filter((p) => ids.has(p.itemId)), introduced, { now, newCap: topic.newCap }));
    }
    return out;
  }, [decks, held, introduced, now, topic.newCap]);
  const ret = useMemo(() => retention(recalls, now), [recalls, now]);
  const retAll = useMemo(() => (liveTopics.length > 1 ? retention(allRecalls, now) : null), [liveTopics.length, allRecalls, now]);
  const week = useMemo(() => dueAheadOfHeld(held, now), [held, now]);
  const peak = Math.max(1, ...week.map((d) => d.count));

  // Every Source something was kept from, with what is ready from it — a Source's count includes its parts'.
  const sources = useMemo(() => {
    const bySource = new Map<string, MaterialDoc[]>();
    for (const m of liveAll) for (const s of chains.get(m.id) ?? []) bySource.set(s, [...(bySource.get(s) ?? []), m]);
    return [...bySource]
      .map(([id, ms]) => {
        const ids = new Set(ms.map((m) => m.id));
        return { id, title: titleOf(id), items: ms, q: queueOfHeld(heldAll.filter((p) => ids.has(p.itemId)), introduced, { now, newCap: capOf }) };
      })
      .sort((a, b) => b.q.due + b.q.newToday - (a.q.due + a.q.newToday) || a.title.localeCompare(b.title));
  }, [liveAll, chains, titleOf, heldAll, introduced, now, capOf]);

  function start(run: Run) {
    if (run.kind === "all") setParams({ [PRACTICE_PARAM]: "all" });
    else if (run.kind === "source") setParams({ [PRACTICE_PARAM]: `source:${run.id}` });
    else setLocal(run);
  }

  function stop() {
    setLocal(null);
    if (params.has(PRACTICE_PARAM)) setParams({});
  }

  if (running) {
    if (running.kind === "all") return <PracticeRun label="Everything" items={everything} recalls={allRecalls} newCap={capOf} onDone={stop} />;
    if (running.kind === "source") {
      const from = everything.filter((m) => chains.get(m.id)?.includes(running.id));
      return <PracticeRun label={`From ${titleOf(running.id)}`} items={from} recalls={allRecalls} newCap={capOf} onDone={stop} />;
    }
    const scope = running.kind === "deck" ? deckItems(running.deck, items) : items;
    return <PracticeRun label={running.kind === "deck" ? `${topic.name} · ${running.deck.name}` : topic.name} items={scope} recalls={recalls} newCap={topic.newCap} onDone={stop} />;
  }

  const ready = q.due + q.newToday;
  const shownSources = allSources ? sources : sources.slice(0, SOURCES_SHOWN);

  return (
    <div className="grid gap-4">
      {liveTopics.length > 1 && (
        <button className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm disabled:opacity-60" onClick={() => start({ kind: "all" })} disabled={liveAll.length === 0}>
          <Shapes className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-medium">Everything</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {qAll.due} due · {qAll.newToday} new · {liveTopics.length} topics
          </span>
          <Play className="size-4 shrink-0" />
        </button>
      )}

      <Card className="py-0">
        <CardContent className="grid justify-items-center gap-3 px-4 py-8 text-center">
          <span className="text-4xl font-semibold tabular-nums">{ready}</span>
          <span className="text-muted-foreground text-sm">
            {q.due} due · {q.newToday} new today{q.newWaiting > q.newToday ? ` · ${q.newWaiting - q.newToday} more new waiting` : ""}
          </span>
          <Button size="lg" className="mt-1 h-12 max-w-full px-8 text-base" onClick={() => start({ kind: "topic" })} disabled={items.length === 0}>
            <Play /> <span className="truncate">Practise {topic.name}</span>
          </Button>
          {items.length === 0 && <span className="text-muted-foreground text-xs">Add a word, a sentence or a fact to begin.</span>}
        </CardContent>
      </Card>

      {decks.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Decks</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {decks.map((d) => {
              const di = deckItems(d, live);
              const dq = deckQueues.get(d.id)!;
              return (
                <button key={d.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-60" onClick={() => start({ kind: "deck", deck: d })} disabled={di.length === 0}>
                  <Layers className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {dq.due} due{dq.newToday ? ` · ${dq.newToday} new` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">From a source</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {shownSources.map((s) => (
              <button key={s.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm" onClick={() => start({ kind: "source", id: s.id })}>
                <BookOpen className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {s.q.due} due{s.q.newToday ? ` · ${s.q.newToday} new` : ""}
                </span>
              </button>
            ))}
          </div>
          {sources.length > SOURCES_SHOWN && (
            <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setAllSources(!allSources)}>
              {allSources ? "Fewer" : `All ${sources.length} sources`}
            </Button>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <section className="grid content-start gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Retention</h2>
          <Card className="py-0">
            <CardContent className="grid gap-0.5 px-4 py-3">
              <span className="text-2xl font-semibold tabular-nums">{ret ? `${Math.round(ret.share * 100)}%` : "—"}</span>
              <span className="text-muted-foreground text-xs">{ret ? `${ret.passed} of ${ret.total} recalls passed, last 30 days` : "Not enough recalls yet"}</span>
              {retAll && <span className="text-muted-foreground text-xs">All topics: {Math.round(retAll.share * 100)}%</span>}
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
