import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Field, formatLength, Input, Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetTitle, TimeField, toast } from "@lifeline/ui";
import {
  addTimeBlock,
  BLOCK_DEFAULT_MIN,
  createFromTimedTemplate,
  describeEnd,
  formatHuman,
  formatTime,
  intakeByKey,
  minutesUntil,
  NEW_TIMED_MIN,
  spanLasting,
  spanProblem,
  timedCreators,
  unplaceItem,
  useIsMobile,
  type DateStr,
  type Handoff,
  type IntakePrefill,
  type PoolItem,
  type TimedTemplate,
} from "@lifeline/core";
import { Ban, Inbox, LayoutTemplate } from "lucide-react";
import { addMinutes, toClock } from "./hours";
import { TOAST_ID } from "./HoursEditor";

export interface AddingAt {
  date: DateStr;
  hours: number;
  /** Hours since that day's midnight where a swept range ends (24 = midnight); absent = an hour after the start. */
  endHours?: number;
  /** Where the tap landed: the desktop popover opens there. */
  point: { x: number; y: number } | null;
}

/**
 * Tapping an empty hour of the Schedule (CONTEXT.md): add there — a new
 * Event from a Start to an End (an End earlier than the Start is the next
 * day's, ADR 0090), or "More…" for the full Event dialog with all of that
 * typed in; an Event template, a Blocker template (which needs an hour and so
 * had no way in on a phone), or unplaced work, which gets a Time block.
 */
export function AddAtHour({ at, templates, pool, onClose }: { at: AddingAt; templates: TimedTemplate[]; pool: (PoolItem & { color?: string })[]; onClose: () => void }) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(() => toClock(at.hours));
  /** How long the new Event lasts (an hour, unless a swept range says otherwise): moving the Start keeps it, and the End is read from it. */
  const [length, setLength] = useState(() => (at.endHours === undefined ? NEW_TIMED_MIN : Math.round((at.endHours - at.hours) * 60)));
  /** "More…" was chosen: the full dialog shows instead. */
  const [more, setMore] = useState<{ handoff: Handoff; prefill: IntakePrefill } | null>(null);
  const creator = timedCreators()[0];
  const intake = creator?.createIntake ? intakeByKey(creator.createIntake) : undefined;
  const span = spanLasting(at.date, start, length);
  const problem = spanProblem(span);
  const valid = !problem;
  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));
  useEffect(() => {
    if (isMobile) toast.dismiss(TOAST_ID);
  }, [isMobile]);
  const virtual = useMemo(() => {
    const p = at.point ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    return { current: { getBoundingClientRect: () => new DOMRect(p.x, p.y, 0, 0) } };
  }, [at.point]);

  function addEvent() {
    if (!creator?.create || !title.trim() || !valid) return;
    const t = title.trim();
    onClose();
    creator
      .create({ title: t, ...span })
      .then(() => toast.success(`${t} at ${formatTime(start)}`, { id: TOAST_ID }))
      .catch(fail);
  }
  function addTemplate(t: TimedTemplate) {
    onClose();
    createFromTimedTemplate(t, at.date, t.durationMin === null ? null : start)
      .then(() => toast.success(t.durationMin === null ? `${t.title} on ${formatHuman(at.date)}` : `${t.title} at ${formatTime(start)}`, { id: TOAST_ID }))
      .catch(fail);
  }
  function plan(w: PoolItem) {
    onClose();
    const len = w.estimateMin && w.estimateMin > 0 ? w.estimateMin : BLOCK_DEFAULT_MIN;
    addTimeBlock(w.appId, w.itemId, at.date, { start, end: addMinutes(start, len) })
      .then((id) => toast.success(`${w.title} at ${formatTime(start)}`, { id: TOAST_ID, action: { label: "Undo", onClick: () => void unplaceItem(id).catch(fail) } }))
      .catch(fail);
  }

  const events = templates.filter((t) => !t.background);
  const blockers = templates.filter((t) => t.background);
  const work = pool.filter((w) => !w.completedOn);
  const heading = `Add on ${formatHuman(at.date)}`;
  const endsLater = span.endDate !== at.date;

  function openMore() {
    // Stable objects for the dialog: it resets whenever they change.
    setMore({
      handoff: { title: title.trim(), text: "" },
      prefill: { title: title.trim(), date: at.date, start, ...(endsLater ? { endDate: span.endDate } : {}), end: span.end },
    });
  }

  const content = (
    <div className="grid gap-3">
      {creator?.create && (
        <div className="grid gap-2">
          <Input
            aria-label="Title"
            autoFocus={!isMobile}
            placeholder="New event"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEvent()}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start">
              <TimeField id="quick-add-start" required value={start} onChange={setStart} />
            </Field>
            <Field label="End" error={problem ?? undefined}>
              <TimeField id="quick-add-end" required value={span.end} aria-describedby={valid ? "quick-add-length" : undefined} onChange={(end) => setLength(minutesUntil(start, end) ?? length)} />
            </Field>
          </div>
          {valid && (
            <p id="quick-add-length" aria-live="polite" className="text-muted-foreground min-w-0 text-sm">
              {describeEnd(span)} · {formatLength(length)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {intake && (
              <Button variant="ghost" onClick={openMore}>
                More…
              </Button>
            )}
            <Button onClick={addEvent} disabled={!title.trim() || !valid}>
              Add
            </Button>
          </div>
        </div>
      )}
      {events.length > 0 && (
        <Group icon={<LayoutTemplate className="size-3.5" />} label="Event templates">
          {events.map((t) => (
            <Button key={t.key} size="sm" variant="outline" className="max-w-full" onClick={() => addTemplate(t)}>
              <span className="truncate">{t.title}</span>
            </Button>
          ))}
        </Group>
      )}
      {blockers.length > 0 && (
        <Group icon={<Ban className="size-3.5" />} label="Blocker templates">
          {blockers.map((t) => (
            <Button key={t.key} size="sm" variant="outline" className="max-w-full border-dashed" onClick={() => addTemplate(t)}>
              <span className="truncate">{t.title}</span>
            </Button>
          ))}
        </Group>
      )}
      {work.length > 0 && (
        <Group icon={<Inbox className="size-3.5" />} label="Unplaced work">
          <div className="grid max-h-48 w-full gap-1 overflow-y-auto">
            {work.map((w) => (
              <button key={w.key} className="hover:bg-accent flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm" onClick={() => plan(w)}>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: w.color ?? "var(--muted-foreground)" }} />
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
                {w.estimateMin ? <span className="text-muted-foreground text-xs tabular-nums">{w.estimateMin}m</span> : null}
              </button>
            ))}
          </div>
        </Group>
      )}
    </div>
  );

  if (more && intake) {
    return <intake.dialog open onOpenChange={(o) => !o && onClose()} handoff={more.handoff} prefill={more.prefill} />;
  }
  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="gap-3 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <span className="bg-muted-foreground/30 mx-auto h-1 w-10 shrink-0 rounded-full" aria-hidden />
          <SheetTitle className="px-0 pt-0">{heading}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor virtualRef={virtual} />
      <PopoverContent side="right" align="start" className="grid w-80 gap-3" aria-label={heading}>
        <div className="text-sm font-medium">{heading}</div>
        {content}
      </PopoverContent>
    </Popover>
  );
}

function Group({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon} {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
