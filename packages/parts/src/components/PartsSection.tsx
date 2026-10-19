import { Button, cn, Input, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, usePhone } from "@lifeline/ui";
import { ChevronDown, ChevronRight, FastForward, ListOrdered, Plus, StepForward } from "lucide-react";
import { useMemo, useState } from "react";
import {
  averageRating,
  caughtUpOf,
  groupName,
  isCaughtUp,
  isRead,
  nextPart,
  partIndex,
  partName,
  posKey,
  progressOf,
  runOf,
  sectionPos,
  usesGroups,
  type PartsMedium,
  type Pos,
  type RunSection,
} from "../domain";
import type { PartsKit, PartsWork } from "../kit";
import { AverageNote, MarksGlance } from "./Marks";
import { GroupDialog, PartDialog } from "./PartDialog";
import { announceRead, attempt } from "./announce";

/** A long run without Groups is shown in blocks of this many, so a thousand chapters stay one screen. */
const BLOCK = 100;

type Tap = "read" | "open";

/** What the list draws: a Group's Parts, or a block of a long ungrouped run. */
interface Shown {
  key: string;
  section: RunSection;
  first: number;
  last: number;
  heading: string;
}

function shownOf(medium: PartsMedium, sections: RunSection[]): Shown[] {
  const out: Shown[] = [];
  for (const s of sections) {
    if (s.group > 0 || sections.length > 1) {
      out.push({ key: `g${s.group}-${s.first}`, section: s, first: s.first, last: s.last, heading: s.group > 0 ? groupName(medium, s.group) : `${medium.parts[0].toUpperCase()}${medium.parts.slice(1)} ${s.first}–${s.last}` });
      continue;
    }
    if (s.last - s.first + 1 <= BLOCK) {
      out.push({ key: "all", section: s, first: s.first, last: s.last, heading: "" });
      continue;
    }
    for (let a = s.first; a <= s.last; a += BLOCK) {
      const b = Math.min(s.last, a + BLOCK - 1);
      out.push({ key: `b${a}`, section: s, first: a, last: b, heading: `${a}–${b}` });
    }
  }
  return out;
}

/** "Caught up to…": one position, read with no day (CONTEXT.md, Part). */
function CatchUp<W extends PartsWork>({ kit, work, medium, grouped }: { kit: PartsKit<W>; work: W; medium: PartsMedium; grouped: boolean }) {
  const caught = caughtUpOf(work);
  const restart = medium.numbering === "restart";
  const [open, setOpen] = useState(false);
  const [g, setG] = useState(String(caught.group || 1));
  const [n, setN] = useState(String(caught.number || ""));
  const withGroup = restart && (grouped || caught.group > 0);

  async function save() {
    const group = withGroup ? Number(g) : 0;
    const number = Number(n);
    if (withGroup && (!Number.isInteger(group) || group < 1)) throw new Error(`${medium.group}: a whole number from 1`);
    if (!Number.isInteger(number) || number < 0) throw new Error(`${medium.part}: a whole number`);
    if (number === 0) await kit.clearCatchUp(work);
    else await kit.catchUp(work, { group, number });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs">
          <FastForward className="size-3.5" /> {caught.number ? `Caught up to ${partName(medium, caught)}` : "Caught up to…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void attempt(save);
          }}
        >
          <p className="text-muted-foreground text-xs">Everything up to here counts as {medium.verb.toLowerCase()}, before Lifeline — no days, nothing in the Daylog. 0 clears it.</p>
          <div className="flex items-end gap-2">
            {withGroup && (
              <div className="grid w-20 gap-1">
                <Label className="text-[11px]">{medium.group}</Label>
                <Input inputMode="numeric" value={g} onChange={(e) => setG(e.target.value)} />
              </div>
            )}
            <div className="grid min-w-0 flex-1 gap-1">
              <Label className="text-[11px]">{medium.part}</Label>
              <Input autoFocus inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
            </div>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** How long the run is, as far as it is known — blank is ongoing. */
function RunLength<W extends PartsWork>({ kit, work, medium, total }: { kit: PartsKit<W>; work: W; medium: PartsMedium; total: number }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(String(total || ""));
  async function save() {
    const v = n.trim() ? Number(n) : 0;
    if (!Number.isInteger(v) || v < 0) throw new Error(`How many ${medium.parts}: a whole number, or blank`);
    await kit.setRunSize(work, v);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setN(String(total || "")); }}>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
          {total ? `of ${total}` : "· ongoing"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void attempt(save); }}>
          <Label className="text-[11px]">How many {medium.parts}</Label>
          <div className="flex gap-2">
            <Input autoFocus inputMode="numeric" placeholder="Ongoing" value={n} onChange={(e) => setN(e.target.value)} />
            <Button type="submit" size="sm">Save</Button>
          </div>
          <p className="text-muted-foreground text-xs">Blank: still going, the end not known.</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A work's Parts (CONTEXT.md, ADR 0074) on its detail: progress, Next part,
 * Caught up to, and the run itself Group by Group — a tap reads a Part (or
 * opens it), a Group's heading opens the Group.
 */
export function PartsSection<W extends PartsWork>({ kit, work }: { kit: PartsKit<W>; work: W }) {
  const medium = kit.config.mediumOf(work);
  const { parts, groups } = kit.useWorkParts(work.id);
  const phone = usePhone();
  const [tap, setTap] = useState<Tap>("read");
  const [openPart, setOpenPart] = useState<Pos | null>(null);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const input = useMemo(() => (medium ? { medium, work, parts, groups } : null), [medium, work, parts, groups]);
  const sections = useMemo(() => (input ? runOf(input) : []), [input]);
  const shown = useMemo(() => (medium ? shownOf(medium, sections) : []), [medium, sections]);
  const next = useMemo(() => (input ? nextPart(input) : null), [input]);
  const progress = useMemo(() => (input ? progressOf(input) : { read: 0, total: 0 }), [input]);
  const idx = useMemo(() => partIndex(parts), [parts]);

  if (!medium || !input) return null;

  if (!work.partsTracked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3">
        <span className="text-muted-foreground min-w-0 flex-1 text-sm">Follow it {medium.part.toLowerCase()} by {medium.part.toLowerCase()}?</span>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => void attempt(() => kit.track(work))}>
          <ListOrdered /> Track {medium.parts}
        </Button>
      </div>
    );
  }

  const caught = caughtUpOf(work);
  const grouped = usesGroups(medium, groups, parts, caught);
  // The block holding the next Part opens by itself — the last one when the next lies past the known end.
  const nextKey = next ? (shown.find((s) => (medium.numbering === "restart" ? s.section.group === next.group : true) && next.number >= s.first && next.number <= s.last) ?? shown[shown.length - 1])?.key : undefined;
  const isOpen = (key: string) => expanded[key] ?? (shown.length === 1 || key === nextKey);
  const pct = progress.total ? Math.min(100, Math.round((progress.read / progress.total) * 100)) : 0;
  const nextGroupNumber = Math.max(0, ...groups.map((g) => g.number), ...parts.map((p) => p.group)) + 1;

  function onTap(pos: Pos) {
    if (tap === "open" || !medium) return setOpenPart(pos);
    const part = idx.get(posKey(pos));
    if (isCaughtUp(pos, caught, part)) return setOpenPart(pos);
    if (part?.readOn) void attempt(() => kit.markUnread(work, pos));
    else void attempt(async () => announceRead(kit, work, medium, await kit.markRead(work, pos)));
  }

  const tapSwitch = phone ? (
    <Select value={tap} onValueChange={(v) => setTap(v as Tap)}>
      <SelectTrigger size="sm" className="h-7 w-auto text-xs" aria-label="A tap">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="read">Tap marks {medium.verb.toLowerCase()}</SelectItem>
        <SelectItem value="open">Tap opens</SelectItem>
      </SelectContent>
    </Select>
  ) : (
    <div className="flex shrink-0 rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="A tap">
      {(["read", "open"] as const).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={tap === t} className={cn("rounded px-2 py-0.5", tap === t ? "bg-accent font-medium" : "text-muted-foreground")} onClick={() => setTap(t)}>
          {t === "read" ? `Tap marks ${medium.verb.toLowerCase()}` : "Tap opens"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <div className="text-muted-foreground min-w-0 text-[11px] tracking-wide uppercase">{medium.parts}</div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span className="tabular-nums">
              {progress.read} {medium.verb.toLowerCase()} <RunLength kit={kit} work={work} medium={medium} total={progress.total} />
            </span>
            <AverageNote average={averageRating(parts)} of={medium.parts} />
          </div>
        </div>
        {progress.total > 0 && (
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {next ? (
          <Button size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => void attempt(async () => announceRead(kit, work, medium, await kit.markRead(work, next)))}>
            <StepForward className="size-3.5" /> {medium.verb}: {partName(medium, next)}
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">All {medium.verb.toLowerCase()}.</span>
        )}
        <CatchUp kit={kit} work={work} medium={medium} grouped={grouped} />
        {(medium.numbering === "runOn" || grouped || parts.length === 0) && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setOpenGroup(-nextGroupNumber)}>
            <Plus className="size-3.5" /> Add {medium.group.toLowerCase()}
          </Button>
        )}
        <div className="ml-auto">{tapSwitch}</div>
      </div>

      <div className="grid gap-2">
        {shown.map((s) => {
          const g = s.section.groupDoc;
          const count = s.last - s.first + 1;
          let read = 0;
          for (let n = s.first; n <= s.last; n++) {
            const pos = sectionPos(medium, s.section, n);
            if (isRead(pos, caught, idx.get(posKey(pos)))) read++;
          }
          const open = isOpen(s.key);
          return (
            <div key={s.key} className="grid gap-1.5">
              {s.heading && (
                <div className="flex min-w-0 items-center gap-1">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm" aria-expanded={open} onClick={() => setExpanded((e) => ({ ...e, [s.key]: !open }))}>
                    {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                    <span className="min-w-0 truncate font-medium">
                      {s.heading}
                      {g?.name ? ` · ${g.name}` : ""}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {read}/{count > 0 ? count : "?"}
                    </span>
                    {g && <MarksGlance liked={g.liked} rating={g.rating} className="text-xs" />}
                  </button>
                  {s.section.group > 0 && (
                    <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" onClick={() => setOpenGroup(s.section.group)}>
                      {g?.body?.trim() ? "Review" : "Open"}
                    </Button>
                  )}
                </div>
              )}
              {open && (
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: Math.max(0, count) }, (_, i) => s.first + i).map((n) => {
                    const pos = sectionPos(medium, s.section, n);
                    const part = idx.get(posKey(pos));
                    const on = isRead(pos, caught, part);
                    const said = !!(part && (part.rating || part.liked || part.body?.trim() || part.name));
                    const isNext = next && next.group === pos.group && next.number === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        title={`${partName(medium, pos)}${part?.name ? ` · ${part.name}` : ""}${on ? ` — ${medium.verb.toLowerCase()}${part?.readOn ? ` ${part.readOn}` : ""}` : ""}`}
                        className={cn(
                          "relative h-7 min-w-9 shrink-0 rounded border px-1 text-xs tabular-nums transition-colors",
                          on ? (part?.readOn ? "bg-primary text-primary-foreground border-primary" : "bg-primary/60 text-primary-foreground border-transparent") : "hover:bg-accent",
                          isNext && !on && "border-primary border-dashed",
                        )}
                        onClick={() => onTap(pos)}
                      >
                        {n}
                        {said && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500" aria-label="has marks or a review" />}
                      </button>
                    );
                  })}
                  {s.section.open && s === shown[shown.length - 1] && (
                    <button type="button" title={`Add ${medium.part.toLowerCase()} ${s.last + 1}`} className="text-muted-foreground hover:bg-accent h-7 min-w-9 shrink-0 rounded border border-dashed px-1 text-xs" onClick={() => onTap(sectionPos(medium, s.section, s.last + 1))}>
                      +
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openPart && <PartDialog kit={kit} work={work} medium={medium} pos={openPart} parts={parts} onClose={() => setOpenPart(null)} />}
      {openGroup !== null && <GroupDialog kit={kit} work={work} medium={medium} number={Math.abs(openGroup)} create={openGroup < 0} groups={groups} parts={parts} onClose={() => setOpenGroup(null)} />}
    </div>
  );
}
