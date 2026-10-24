import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { displayTitle, docHref, documentType, useLinkIndex } from "@lifeline/core";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TagChips,
  toast,
  Tip,
} from "@lifeline/ui";
import { ArrowLeft, Check, Pencil, Skull, Trash2 } from "lucide-react";
import { computeProgression } from "../domain/progression";
import { LIFELEVEL_HREF } from "../domain/daylog";
import { damageForNegativeCompletion, xpGainForPositiveCompletion } from "../domain/difficulty";
import {
  deleteCompletion,
  deleteHabit,
  useHabit,
  useHabitCompletions,
  useHabits,
  useNegativeCompletions,
  useNegatives,
  useProgressionNow,
} from "../data/repo";
import { DoneTodayBadge, formatTimeUntil, XpBar } from "../components/HabitCard";
import { HabitEditorDialog } from "../components/HabitEditorDialog";
import { CompleteHabitDialog } from "../components/LogDialogs";

type LedgerRow = {
  id: string;
  occurredAt: string;
  kind: "completion" | "hit";
  label: string;
  delta: number;
  note: string;
};

/** One Habit's track: derived state up top, the honest ledger below. */
export function HabitDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const habit = useHabit(id);
  const habits = useHabits();
  const negatives = useNegatives();
  const habitCompletions = useHabitCompletions();
  const negativeCompletions = useNegativeCompletions();
  const now = useProgressionNow();
  const linkIndex = useLinkIndex();
  const backlinks = useMemo(
    () =>
      (id ? linkIndex.backlinksTo(id) : []).flatMap((b) => {
        const src = linkIndex.byId.get(b.sourceId);
        if (!src) return [];
        return [{ sourceId: b.sourceId, title: displayTitle(src, documentType(src.type)), href: docHref(src), excerpt: b.context }];
      }),
    [linkIndex, id],
  );
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const state = useMemo(() => {
    if (!id) return undefined;
    return computeProgression(habits, negatives, habitCompletions, negativeCompletions, now).habits.find((s) => s.habitId === id);
  }, [id, habits, negatives, habitCompletions, negativeCompletions, now]);

  const ledger: LedgerRow[] = useMemo(() => {
    if (!habit) return [];
    const negativeById = new Map(negatives.map((n) => [n.id, n]));
    const rows: LedgerRow[] = habitCompletions
      .filter((c) => c.habitId === habit.id)
      .map((c) => ({
        id: c.id,
        occurredAt: c.occurredAt,
        kind: "completion" as const,
        label: "Completed",
        delta: xpGainForPositiveCompletion(habit.difficulty),
        note: c.note,
      }));
    for (const c of negativeCompletions) {
      if (c.affectedHabitId !== habit.id) continue;
      const n = negativeById.get(c.negativeId);
      rows.push({
        id: c.id,
        occurredAt: c.occurredAt,
        kind: "hit",
        label: n ? n.title : "Negative",
        delta: n ? -damageForNegativeCompletion(n.gravity) : 0,
        note: c.note,
      });
    }
    return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [habit, negatives, habitCompletions, negativeCompletions]);

  if (!habit || !state) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Habit not found.</div>;
  }
  const debt = state.rawXp < 0;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:gap-6 sm:p-6">
      <div className="grid gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Tip label="Back">
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => navigate(LIFELEVEL_HREF)}>
              <ArrowLeft />
            </Button>
          </Tip>
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{habit.title}</h1>
          <Tip label="Edit">
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil />
            </Button>
          </Tip>
          <Tip label="Delete habit">
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
            </Button>
          </Tip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">Lv {state.level}</Badge>
          <Badge variant="outline">{state.difficulty}</Badge>
          <DoneTodayBadge completionsToday={state.completionsToday} />
          <Button className="ml-auto" variant={state.completionsToday > 0 ? "secondary" : "default"} onClick={() => setLogOpen(true)}>
            {state.completionsToday > 0 ? "Complete again" : "Complete"}
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-semibold tabular-nums sm:text-4xl ${debt ? "text-rose-500" : ""}`}>{Math.round(state.rawXp)}</span>
          <span className="text-muted-foreground text-sm">raw XP</span>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {debt ? "in debt — climb back to 0 before levels move again" : `${Math.round(state.expIntoLevel)} / ${state.expPerLevel} into Lv ${state.level}`}
        </span>
        <span className="text-muted-foreground text-sm">{state.nextDecayAt ? `decay in ${formatTimeUntil(state.nextDecayAt, now)}` : "safe from decay"}</span>
        <span className="text-muted-foreground text-sm tabular-nums">{state.completionCount}× all time</span>
        {(habit.tags ?? []).length > 0 && <TagChips tags={habit.tags} size="xs" />}
      </div>
      <XpBar state={state} className="h-3" />

      <section className="grid gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">Ledger</h2>
        {ledger.length === 0 && <p className="text-muted-foreground text-sm">Nothing logged yet. The clock is already running.</p>}
        <ul className="grid gap-1">
          {ledger.slice(0, 200).map((r) => (
            <li key={r.id} className="bg-card flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm sm:gap-3">
              {r.kind === "completion" ? <Check className="size-4 shrink-0 text-emerald-600" /> : <Skull className="size-4 shrink-0 text-rose-500" />}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate">
                  {r.label}
                  {r.note && <span className="text-muted-foreground ml-2 text-xs">{r.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs sm:gap-3">
                  <span className={`tabular-nums ${r.delta < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {r.delta < 0 ? "−" : "+"}
                    {Math.round(Math.abs(r.delta))} XP
                  </span>
                  <span className="text-muted-foreground">{new Date(r.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
              </div>
              <Tip label={r.kind === "completion" ? "Delete this completion" : "Delete this negative log"}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() =>
                    void deleteCompletion(r.id).then(() =>
                      toast.success(r.kind === "completion" ? "Completion removed — its XP with it" : "Negative log removed — the XP damage is undone"),
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Tip>
            </li>
          ))}
        </ul>
      </section>

      {backlinks.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Mentioned in</h2>
          <ul className="grid gap-1">
            {backlinks.map((b) => (
              <li key={b.sourceId} className="min-w-0">
                <button type="button" className="max-w-full truncate text-left text-sm hover:underline disabled:no-underline" disabled={!b.href} onClick={() => b.href && navigate(b.href)}>
                  {b.title}
                </button>
                {b.excerpt && <span className="text-muted-foreground ml-2 text-xs">{b.excerpt}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <CompleteHabitDialog open={logOpen} onOpenChange={setLogOpen} habit={habit} />
      <HabitEditorDialog open={editOpen} onOpenChange={setEditOpen} habit={habit} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quit "{habit.title}"?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Honest quitting: its earned levels and its XP debt die together. Every completion — and every negative log that hit this habit — is deleted with it. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep at it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void deleteHabit(habit.id).then(() => {
                  toast.success("Habit deleted — progress and debt forfeited");
                  navigate(LIFELEVEL_HREF);
                });
              }}
            >
              Quit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
