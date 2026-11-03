import { matchesTagFilter, useTagFilter, type CardProps, useOpenPeek } from "@lifeline/core";
import { finishedIn, mediumBreakdown } from "../domain/cardQueries";
import { useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { mediumOf } from "./shared";

/** Card: how much I finished in a year, with the latest covers. */
export function FinishedCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  const year = typeof settings.year === "number" ? settings.year : new Date().getFullYear();
  // A game is peeked from a Card (ADR 0057); its Peek links through to its page.
  const peek = useOpenPeek();
  const done = finishedIn(items, year, medium);
  const breakdown = medium ? "" : mediumBreakdown(done);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: "var(--chart-magenta)" }}>
          {done.length}
        </span>
        <span className="text-muted-foreground text-sm">finished in {year}</span>
        {breakdown && <span className="text-muted-foreground ml-auto truncate text-xs">{breakdown}</span>}
      </div>
      {done.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">Nothing finished in {year} yet.</div>
      ) : (
        <ul className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
          {done.map((m) => (
            <li key={m.id} className="flex cursor-pointer justify-center" title={`${m.title}${m.creator ? ` — ${m.creator}` : ""} · ${m.finishedOn}`} onClick={() => peek(m.id)}>
              {/* The row opens on a click anywhere; this button is its face for the keyboard (Enter bubbles to the row). */}
              <button type="button" aria-label={`${m.title}${m.creator ? ` — ${m.creator}` : ""} · ${m.finishedOn}`} className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none flex flex-col items-center gap-0.5">
                <Cover item={m} className="h-16 w-12" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
