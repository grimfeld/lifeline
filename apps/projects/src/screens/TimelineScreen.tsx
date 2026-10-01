import { useState } from "react";
import { Link } from "react-router";
import { Button, cn } from "@lifeline/ui";
import { addDays, diffDays, fromParts, parts, todayStr, type DateStr } from "@lifeline/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { byRank } from "../domain/board";
import { isOpenStage, projectHref, type Milestone, type Project } from "../domain/types";
import { useMilestones, useProjects } from "../data/repo";
import { Face, faceColor } from "../components/parts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPAN = 6;

function monthStart(d: DateStr, shift = 0): DateStr {
  const { y, m } = parts(d);
  const k = y * 12 + (m - 1) + shift;
  return fromParts(Math.floor(k / 12), (k % 12) + 1, 1);
}

/**
 * The Projects across months (ADR 0060): each a bar from its start to its
 * Deadline, its Milestones' Deadlines flagged along it, today a line. A
 * Project the timeline cannot place — no start and no Deadline — is listed
 * beside it, counted, never silently left out.
 */
export function TimelineScreen() {
  const projects = useProjects();
  const milestones = useMilestones();
  const today = todayStr();
  const [from, setFrom] = useState(() => monthStart(today, -1));
  const [ended, setEnded] = useState(false);
  const to = addDays(monthStart(from, SPAN), -1);
  const days = diffDays(from, to) + 1;
  const x = (d: DateStr) => (Math.min(Math.max(diffDays(from, d), 0), days) / days) * 100;

  const shown = projects.filter((p) => ended || isOpenStage(p.stage)).sort(byRank);
  const placed = shown.filter((p) => p.start || p.deadline);
  const unplaced = shown.filter((p) => !p.start && !p.deadline);
  const months = Array.from({ length: SPAN }, (_, i) => monthStart(from, i));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Timeline</h1>
        <div className="ml-auto flex items-center gap-1">
          <label className="text-muted-foreground mr-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={ended} onChange={(e) => setEnded(e.target.checked)} /> Done &amp; dropped
          </label>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setFrom(monthStart(from, -1))} aria-label="Earlier">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom(monthStart(today, -1))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setFrom(monthStart(from, 1))} aria-label="Later">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="text-muted-foreground relative ml-48 flex border-b text-xs">
            {months.map((m) => (
              <div key={m} className="flex-1 border-l px-1 py-1" style={{ flexGrow: diffDays(m, monthStart(m, 1)) }}>
                {MONTHS[parts(m).m - 1]} {parts(m).m === 1 || m === from ? parts(m).y : ""}
              </div>
            ))}
          </div>
          <div className="relative">
            {today >= from && today <= to && <div className="bg-destructive/60 pointer-events-none absolute top-0 bottom-0 z-10 w-px" style={{ left: `calc(12rem + (100% - 12rem) * ${x(today) / 100})` }} />}
            {placed.length === 0 && <p className="text-muted-foreground py-6 pl-48 text-sm">No project has a start or a deadline yet.</p>}
            {placed.map((p) => (
              <TimelineRow key={p.id} project={p} milestones={milestones} from={from} to={to} x={x} today={today} />
            ))}
          </div>
        </div>
      </div>

      {unplaced.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-muted-foreground text-sm font-medium">Not on the timeline ({unplaced.length}) — no start, no deadline</h2>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((p) => (
              <Link key={p.id} to={projectHref(p.id)} className="hover:bg-accent/40 flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                <Face project={p} className="size-5 text-xs" /> {p.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TimelineRow({ project, milestones, from, to, x, today }: { project: Project; milestones: Milestone[]; from: DateStr; to: DateStr; x: (d: DateStr) => number; today: DateStr }) {
  // A bar needs two ends: the start (else the day it became Active, else made), the Deadline (else the start).
  const begin = project.start ?? project.startedOn ?? project.createdAt;
  const end = project.deadline ?? project.endedOn ?? begin;
  const a = begin <= end ? begin : end;
  const b = begin <= end ? end : begin;
  const visible = b >= from && a <= to;
  const late = !!project.deadline && project.deadline < today && isOpenStage(project.stage);
  const flags = milestones.filter((m) => m.project === project.id && m.deadline && m.deadline >= from && m.deadline <= to);
  return (
    <div className="flex h-10 items-center border-b">
      <Link to={projectHref(project.id)} className="hover:text-primary flex w-48 shrink-0 items-center gap-2 truncate pr-2 text-sm">
        <Face project={project} className="size-5 text-xs" />
        <span className="truncate">{project.title}</span>
      </Link>
      <div className="relative h-full flex-1">
        {visible && (
          <Link
            to={projectHref(project.id)}
            className={cn("absolute top-2.5 h-5 min-w-1.5 rounded-sm opacity-80 hover:opacity-100", !isOpenStage(project.stage) && "opacity-40", late && "ring-destructive ring-2")}
            style={{ left: `${x(a)}%`, width: `${Math.max(x(b) - x(a), 0.6)}%`, background: faceColor(project) }}
            title={`${project.title}: ${a} → ${b}`}
          />
        )}
        {flags.map((m) => (
          <span
            key={m.id}
            className={cn("absolute top-0.5 z-[5] -translate-x-1/2 text-xs", m.reachedOn ? "opacity-50" : "")}
            style={{ left: `${x(m.deadline as DateStr)}%` }}
            title={`${m.title} · ${m.deadline}${m.reachedOn ? " · reached" : ""}`}
          >
            ⚑
          </span>
        ))}
      </div>
    </div>
  );
}
