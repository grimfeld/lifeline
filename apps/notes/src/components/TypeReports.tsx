import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { reportsIn, reportsOf, todayStr, useDocumentTypes, useTopMentioned, type DocumentTypeDef, type LinkIndex, type LinkRef, type ReportSetting, type ReportWindow } from "@lifeline/core";
import { RankingReport, useOpenLinkRef } from "@lifeline/editor";
import { Input, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { periodRange } from "../domain/periods";

const WINDOWS = { month: "This month", year: "This year", all: "All time", custom: "Custom" } as const;
type WindowName = keyof typeof WINDOWS;

const typeHref = (type: string) => `/app/journal/t/${type}`;

/**
 * A type's ranking Reports on its page (ADR 0076), over a window chosen in the
 * page's controls: this month, this year, all time or two dates — kept in the
 * address so a period's "more" link can open it on that period.
 */
export function TypeReports({ type, index }: { type: DocumentTypeDef; index: LinkIndex }) {
  const [params, setParams] = useSearchParams();
  const onOpen = useOpenLinkRef(index);
  const chosen = reportsIn(type, "ranking");
  const name = (params.get("w") as WindowName) in WINDOWS ? (params.get("w") as WindowName) : "month";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const today = todayStr();
  const window: ReportWindow = useMemo(() => {
    if (name === "month") return { from: `${today.slice(0, 7)}-01` };
    if (name === "year") return { from: `${today.slice(0, 4)}-01-01` };
    if (name === "custom") return { from: from || undefined, to: to || undefined };
    return {};
  }, [name, from, to, today]);
  if (chosen.length === 0) return null;
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };
  const ranksOverWindow = chosen.some((r) => r.kind === "top");
  return (
    <section className="grid min-w-0 gap-3">
      {ranksOverWindow && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-md:contents">
          <PhoneDock order={1}>
            <Select value={name} onValueChange={(v) => set({ w: v })}>
              <SelectTrigger className="h-8 w-36 max-md:w-auto" aria-label="Reports over">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(WINDOWS) as WindowName[]).map((w) => (
                  <SelectItem key={w} value={w}>
                    {WINDOWS[w]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PhoneDock>
          {name === "custom" && (
            <>
              <Input type="date" className="h-8 w-40" value={from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
              <Input type="date" className="h-8 w-40" value={to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
            </>
          )}
        </div>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {chosen.map((r) => (
          <RankingReport key={r.kind} index={index} typeId={type.id} setting={r} window={window} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

/**
 * A period's roll-up (ADR 0076): for every type with Top mentioned, who came up
 * on the most of the period's Days. A type with nothing in the period is left
 * out, so a quiet Week isn't padded with empty blocks.
 */
export function PeriodReports({ periodKey, index }: { periodKey: string; index: LinkIndex }) {
  const types = useDocumentTypes();
  const onOpen = useOpenLinkRef(index);
  const range = periodRange(periodKey);
  if (!range) return null;
  const blocks = types.flatMap((t) => {
    const top = reportsOf(t).find((r) => r.kind === "top");
    return top ? [{ t, top }] : [];
  });
  return (
    <>
      {blocks.map(({ t, top }) => (
        <PeriodBlock key={t.id} type={t} top={top} window={range} index={index} onOpen={onOpen} />
      ))}
    </>
  );
}

function PeriodBlock({ type, top, window, index, onOpen }: { type: DocumentTypeDef; top: ReportSetting; window: { from: string; to: string }; index: LinkIndex; onOpen: (ref: LinkRef, name: string) => void }) {
  const any = useTopMentioned(index, type.id, window).length > 0;
  if (!any) return null;
  const homed = !type.builtIn && type.homeModule === "journal";
  return (
    <div className="grid min-w-0 gap-0.5">
      <RankingReport index={index} typeId={type.id} setting={top} window={window} title={type.label} onOpen={onOpen} />
      {homed && (
        <Link to={`${typeHref(type.id)}?w=custom&from=${window.from}&to=${window.to}`} className="text-muted-foreground justify-self-end text-xs hover:underline">
          More →
        </Link>
      )}
    </div>
  );
}
