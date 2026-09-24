import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input, Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetTitle, toast } from "@lifeline/ui";
import {
  addTimeBlock,
  BLOCK_DEFAULT_MIN,
  createFromTimedTemplate,
  formatHuman,
  formatTime,
  timedCreators,
  unplaceItem,
  useIsMobile,
  type DateStr,
  type PoolItem,
  type TimedTemplate,
} from "@lifeline/core";
import { Ban, Inbox, LayoutTemplate } from "lucide-react";
import { addMinutes, toClock } from "./hours";
import { TOAST_ID } from "./HoursEditor";

export interface AddingAt {
  date: DateStr;
  hours: number;
  /** Where the tap landed: the desktop popover opens there. */
  point: { x: number; y: number } | null;
}

/**
 * Tapping an empty hour of the Schedule (CONTEXT.md): add there — a new
 * Event, an Event template, a Blocker template (which needs an hour and so
 * had no way in on a phone), or unplaced work, which gets a Time block.
 */
export function AddAtHour({ at, templates, pool, onClose }: { at: AddingAt; templates: TimedTemplate[]; pool: (PoolItem & { color?: string })[]; onClose: () => void }) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const creator = timedCreators()[0];
  const start = toClock(at.hours);
  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));
  useEffect(() => {
    if (isMobile) toast.dismiss(TOAST_ID);
  }, [isMobile]);
  const virtual = useMemo(() => {
    const p = at.point ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    return { current: { getBoundingClientRect: () => new DOMRect(p.x, p.y, 0, 0) } };
  }, [at.point]);

  function addEvent() {
    if (!creator?.create || !title.trim()) return;
    const t = title.trim();
    onClose();
    creator
      .create({ title: t, date: at.date, start, end: addMinutes(start, 60) })
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
  const heading = `Add at ${formatHuman(at.date)} · ${formatTime(start)}`;

  const content = (
    <div className="grid gap-3">
      {creator?.create && (
        <div className="flex gap-2">
          <Input autoFocus={!isMobile} placeholder="New event" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEvent()} />
          <Button onClick={addEvent} disabled={!title.trim()}>
            Add
          </Button>
        </div>
      )}
      {events.length > 0 && (
        <Group icon={<LayoutTemplate className="size-3.5" />} label="Event templates">
          {events.map((t) => (
            <Button key={t.key} size="sm" variant="outline" onClick={() => addTemplate(t)}>
              {t.title}
            </Button>
          ))}
        </Group>
      )}
      {blockers.length > 0 && (
        <Group icon={<Ban className="size-3.5" />} label="Blocker templates">
          {blockers.map((t) => (
            <Button key={t.key} size="sm" variant="outline" className="border-dashed" onClick={() => addTemplate(t)}>
              {t.title}
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
      <PopoverContent side="right" align="start" className="grid w-80 gap-3">
        <div className="text-sm font-medium">{heading}</div>
        {content}
      </PopoverContent>
    </Popover>
  );
}

function Group({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon} {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
