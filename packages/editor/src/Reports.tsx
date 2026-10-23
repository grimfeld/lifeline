import { useMemo } from "react";
import {
  REPORT_KINDS,
  addDays,
  diffDays,
  displayTitle,
  documentType,
  formatHuman,
  rankingRows,
  reportKind,
  reportsIn,
  startOfWeek,
  todayStr,
  useDocumentFigures,
  type DateStr,
  type DocumentTypeDef,
  type LinkIndex,
  type LinkRef,
  type RankRow,
  type ReportSetting,
  type ReportWindow,
} from "@lifeline/core";
import { Button, Checkbox, Input, cn } from "@lifeline/ui";
import { ArrowDown, ArrowUp } from "lucide-react";

/*
 * Reports (CONTEXT.md, ADR 0076) as the user sees them: a ranking Report over
 * a type's Documents, one Document's own figures, and the editor a type
 * chooses its Reports in. Figures come from @lifeline/core; nothing is stored.
 */

const HEADING = "text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase";

function ago(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** A ranking Report: a type's Documents with the Days that link to them. */
export function RankingReport({
  index,
  typeId,
  setting,
  window = {},
  title,
  onOpen,
  empty,
}: {
  index: LinkIndex;
  typeId: string;
  setting: ReportSetting;
  window?: ReportWindow;
  /** Heading; default the kind's label. */
  title?: string;
  onOpen: (ref: LinkRef, name: string) => void;
  /** What an empty Report says; null hides it. */
  empty?: string | null;
}) {
  const today = todayStr();
  const rows = useMemo(() => rankingRows(index, typeId, setting, window, today), [index, typeId, setting, window.from, window.to, today]); // eslint-disable-line react-hooks/exhaustive-deps
  if (rows.length === 0 && empty === null) return null;
  return (
    <section className="min-w-0">
      <h3 className={HEADING}>{title ?? reportKind(setting.kind).label}</h3>
      {rows.length === 0 ? <p className="text-muted-foreground text-xs">{empty ?? "No Day links to any yet."}</p> : <RankList index={index} rows={rows} quiet={setting.kind === "quiet"} onOpen={onOpen} />}
    </section>
  );
}

function RankList({ index, rows, quiet, onOpen }: { index: LinkIndex; rows: RankRow[]; quiet: boolean; onOpen: (ref: LinkRef, name: string) => void }) {
  const today = todayStr();
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="grid min-w-0 gap-0.5">
      {rows.map((r) => {
        const d = index.byId.get(r.docId);
        const name = d ? displayTitle(d, documentType(d.type)) : "?";
        return (
          <li key={r.docId} className="min-w-0">
            <button type="button" className="hover:bg-accent relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded px-1.5 py-1 text-left text-sm" onClick={() => onOpen({ kind: "doc", id: r.docId, type: d?.type ?? "" }, name)}>
              {!quiet && <span aria-hidden className="bg-primary/10 absolute inset-y-0 left-0" style={{ width: `${(r.count / max) * 100}%` }} />}
              <span className="relative min-w-0 flex-1 truncate">{name}</span>
              <span className="text-muted-foreground relative shrink-0 text-xs tabular-nums" title={`Last: ${formatHuman(r.last)}`}>
                {quiet ? ago(diffDays(r.last, today)) : `×${r.count}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One Document's own Reports, in its type's order: last mentioned, counts, heatmap. Nothing when the type chose none. */
export function DocumentReports({ index, def, docId }: { index: LinkIndex; def: DocumentTypeDef | undefined; docId: string }) {
  const today = todayStr();
  const chosen = reportsIn(def, "document");
  const f = useDocumentFigures(index, docId, today);
  if (chosen.length === 0) return null;
  return (
    <section className="grid min-w-0 gap-2 text-sm">
      <h3 className={cn(HEADING, "mb-0")}>Reports</h3>
      {chosen.map((r) => {
        if (r.kind === "last")
          return (
            <div key={r.kind} className="flex min-w-0 items-baseline gap-2">
              <span className="text-muted-foreground shrink-0 text-xs">Last mentioned</span>
              <span className="min-w-0 flex-1 truncate text-right">{f.last ? `${formatHuman(f.last)} · ${ago(f.sinceLast ?? 0)}` : "never"}</span>
            </div>
          );
        if (r.kind === "count")
          return (
            <div key={r.kind} className="flex min-w-0 items-baseline gap-2">
              <span className="text-muted-foreground shrink-0 text-xs">Days</span>
              <span className="min-w-0 flex-1 truncate text-right tabular-nums">
                {f.thisYear} this year · {f.allTime} in all
              </span>
            </div>
          );
        if (r.kind === "heatmap") return <MentionHeatmap key={r.kind} days={f.days} today={today} />;
        return null;
      })}
    </section>
  );
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** The last 12 months as week columns of seven days, a linking Day filled. */
export function MentionHeatmap({ days, today }: { days: Set<DateStr>; today: DateStr }) {
  const weeks = useMemo(() => {
    const first = startOfWeek(addDays(today, -364));
    const cols: DateStr[][] = [];
    for (let w = first; w <= today; w = addDays(w, 7)) cols.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
    return cols;
  }, [today]);
  const inYear = [...days].filter((d) => d > addDays(today, -365)).length;
  return (
    <div className="grid min-w-0 gap-1">
      {/* A year of weeks is wider than a narrow column: it scrolls rather than squeezing the days unreadable. */}
      <div className="overflow-x-auto" data-scroll-x>
        <div className="flex w-max gap-[2px]" role="img" aria-label={`${inYear} Days in the last 12 months`}>
          {weeks.map((col) => (
            <div key={col[0]} className="grid gap-[2px]">
              <span className="text-muted-foreground h-3 text-2xs leading-3">{col.some((d) => d.endsWith("-01")) ? MONTHS[Number(col.find((d) => d.endsWith("-01"))!.slice(5, 7)) - 1] : ""}</span>
              {col.map((d) => (
                <span key={d} title={d <= today ? formatHuman(d) : undefined} className={cn("size-2 rounded-[2px]", d > today ? "opacity-0" : days.has(d) ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="text-muted-foreground text-2xs">{inYear} Days in the last 12 months</span>
    </div>
  );
}

/**
 * The editor for a type's Reports: the chosen ones first, in order, with their
 * parameters; then the rest of the catalogue, off.
 */
export function ReportsEditor({ value, onChange }: { value: ReportSetting[]; onChange: (next: ReportSetting[]) => void }) {
  const off = REPORT_KINDS.filter((k) => !value.some((r) => r.kind === k.kind));
  const move = (i: number, by: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange(next);
  };
  const patch = (i: number, p: Partial<ReportSetting>) => onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  return (
    <div className="grid gap-1">
      {value.map((r, i) => {
        const k = reportKind(r.kind);
        return (
          <div key={r.kind} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border px-2 py-1">
            <Checkbox checked onCheckedChange={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Turn off ${k.label}`} />
            <span className="min-w-0 flex-1 truncate text-sm" title={k.description}>
              {k.label}
              <span className="text-muted-foreground ml-1.5 text-2xs uppercase">{k.family === "ranking" ? "type" : "each"}</span>
            </span>
            {k.params.n !== undefined && (
              <label className="flex shrink-0 items-center gap-1 text-xs">
                Top
                <Input type="number" className="w-14" min={1} max={50} value={r.n ?? k.params.n} onChange={(e) => patch(i, { n: num(e.target.value, 1, 50) })} aria-label={`${k.label}: how many`} />
              </label>
            )}
            {k.params.days !== undefined && (
              <label className="flex shrink-0 items-center gap-1 text-xs">
                for
                <Input type="number" className="w-16" min={1} max={3650} value={r.days ?? k.params.days} onChange={(e) => patch(i, { days: num(e.target.value, 1, 3650) })} aria-label={`${k.label}: days`} />
                days
              </label>
            )}
            <div className="flex shrink-0">
              <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${k.label} up`}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${k.label} down`}>
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
      {off.map((k) => (
        <label key={k.kind} className="text-muted-foreground flex min-w-0 items-center gap-2 px-2 py-1 text-sm">
          <Checkbox checked={false} onCheckedChange={() => onChange([...value, { kind: k.kind, ...k.params }])} />
          <span className="min-w-0 flex-1 truncate" title={k.description}>
            {k.label}
            <span className="ml-1.5 text-2xs uppercase">{k.family === "ranking" ? "type" : "each"}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
