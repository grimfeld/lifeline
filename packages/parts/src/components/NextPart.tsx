import { Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { partName, type Group, type Part } from "../domain";
import type { PartsKit, PartsWork } from "../kit";
import { announceRead, attempt } from "./announce";

/** Works whose next Part can be read: a medium with Parts, not Done, tracked or in progress. */
export function nextCandidates<W extends PartsWork>(kit: PartsKit<W>, works: W[]): W[] {
  return works.filter((w) => kit.config.mediumOf(w) && w.engagement !== "DONE" && w.engagement !== "ABANDONED" && (w.partsTracked || w.engagement === "IN_PROGRESS"));
}

/**
 * "+1" (CONTEXT.md, Part — Next part): the lowest unread Part, read today,
 * one tap from a work on a Card. Rows come from the Card's one shared query.
 */
export function NextPartButton<W extends PartsWork>({ kit, work, parts, groups, className }: { kit: PartsKit<W>; work: W; parts: Part[]; groups: Group[]; className?: string }) {
  const medium = kit.config.mediumOf(work);
  const next = kit.nextOf(work, parts, groups);
  if (!medium || !next || work.engagement === "DONE") return null;
  const label = `${medium.verb} ${partName(medium, next)}`;
  return (
    <Button
      size="sm"
      variant="outline"
      title={label}
      aria-label={label}
      className={cn("h-6 shrink-0 gap-0.5 px-1.5 text-[11px] tabular-nums", className)}
      onClick={(e) => {
        e.stopPropagation();
        void attempt(async () => announceRead(kit, work, medium, await kit.readNext(work)));
      }}
    >
      <Plus className="size-3" />1
    </Button>
  );
}

const LIMIT = 12;

/**
 * "Next part of…" — the capture sheet's one-tap: type a few letters, tap the
 * work, its next Part is read today. In progress first.
 */
export function NextPartDialog<W extends PartsWork>({
  kit,
  works,
  open,
  onOpenChange,
  title,
  matches,
  cover,
  byline,
  initialQuery = "",
}: {
  kit: PartsKit<W>;
  works: W[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  matches: (w: W, q: string) => boolean;
  cover?: (w: W) => ReactNode;
  byline?: (w: W) => ReactNode;
  /** The search opens holding this (the palette's inline line). */
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const { parts, groups } = kit.useAllParts();
  const rows = useMemo(
    () =>
      nextCandidates(kit, works)
        .filter((w) => matches(w, q))
        .sort((a, b) => Number(b.engagement === "IN_PROGRESS") - Number(a.engagement === "IN_PROGRESS") || a.title.localeCompare(b.title))
        .slice(0, LIMIT),
    [kit, works, q, matches],
  );

  function close(o: boolean) {
    if (!o) setQ("");
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Input autoFocus placeholder="Title, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Nothing in progress matches.</p>
          ) : (
            <ul className="grid max-h-80 gap-0.5 overflow-y-auto">
              {rows.map((w) => {
                const medium = kit.config.mediumOf(w)!;
                const next = kit.nextOf(w, parts, groups);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      disabled={!next}
                      className="hover:bg-accent flex w-full min-w-0 items-center gap-3 rounded-md p-1.5 text-left disabled:opacity-50"
                      onClick={() =>
                        void attempt(async () => {
                          announceRead(kit, w, medium, await kit.readNext(w));
                          close(false);
                        })
                      }
                    >
                      {cover?.(w)}
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{w.title}</span>
                        {byline && <span className="text-muted-foreground truncate text-xs">{byline(w)}</span>}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{next ? partName(medium, next) : "All read"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
