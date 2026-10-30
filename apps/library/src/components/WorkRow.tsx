import { Link } from "react-router";
import { Badge, Button, cn, TagChips } from "@lifeline/ui";
import { AlertTriangle, ArrowDownToLine, Check, Play, ShoppingCart } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { acquire, finish, freeSlotsOf, isBuySignal, isStale, promote, slotAge, start } from "../domain/rules";
import { workHref } from "../constants";
import { Cover } from "./Cover";
import { WorkActionsMenu, actOn } from "./WorkActions";
import { ACQ_LABEL } from "../domain/types";
import { AuthorNames } from "./AuthorNames";

/** One media item — on a slot or in the backlog — with its transitions. */
export function WorkRow({ item, all, compact = false }: { item: Work; all: Work[]; compact?: boolean }) {
  const def = workType(item.type);
  const slotted = item.slot > 0;
  const age = slotAge(item);
  const stale = isStale(item);
  const free = freeSlotsOf(all, item.type);
  const buy = isBuySignal(item);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";

  const act = actOn(item);

  return (
    <div className={cn("bg-card flex items-center gap-3 rounded-lg border px-3 py-2", compact && "px-2 py-1.5")}>
      <Cover item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link to={workHref(item.id)} className="truncate text-sm font-medium underline-offset-2 hover:underline">
            {item.title}
          </Link>
          {slotted && <span className="text-muted-foreground shrink-0 text-xs">#{item.slot}</span>}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          <AuthorNames item={item} stop />
          {item.authors.length && item.year ? " · " : ""}
          {item.year || ""}
          {!compact && item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </div>
        {!compact && item.reason && <div className="text-muted-foreground line-clamp-2 text-xs italic">{item.reason}</div>}
        {(item.tags ?? []).length > 0 && <TagChips tags={item.tags} size="xs" className="mt-0.5" />}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {buy && (
            <Badge variant="default" className="gap-1">
              <ShoppingCart className="size-3" /> buy this
            </Badge>
          )}
          {reading && <Badge>{def.engagement.IN_PROGRESS}</Badge>}
          {!slotted && !reading && <Badge variant="outline">{ACQ_LABEL[item.acquisition]}</Badge>}
          {!slotted && item.engagement !== "UNSTARTED" && !reading && <Badge variant="secondary">{def.engagement[item.engagement]}</Badge>}
          {slotted && age !== null && (
            <span className={cn("flex items-center gap-1 text-xs", stale ? "text-destructive" : "text-muted-foreground")}>
              {stale && <AlertTriangle className="size-3" />}
              {age}d in this slot
            </span>
          )}
        </div>
      </div>

      {!compact && slotted && (
        <div className="hidden shrink-0 gap-1 sm:flex">
          {buy && (
            <Button size="sm" variant="outline" onClick={act("Got it", acquire("OWNED"))}>
              Got it
            </Button>
          )}
          {!reading && item.acquisition !== "WANTED" && (
            <Button size="sm" variant="outline" onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
              <Play /> {def.startVerb}
            </Button>
          )}
          <Button size="sm" onClick={act(`${item.title} — ${def.engagement.DONE.toLowerCase()}. Slot freed.`, finish())}>
            <Check /> {def.finishVerb}
          </Button>
        </div>
      )}
      {!compact && !slotted && !done && (
        <Button size="sm" variant="outline" className="shrink-0" disabled={free.length === 0} title={free.length === 0 ? `The ${def.plural.toLowerCase()} nightstand is full` : ""} onClick={act(`Slot ${free[0]} taken`, promote(free[0]!))}>
          <ArrowDownToLine /> Slot it
        </Button>
      )}

      <WorkActionsMenu item={item} all={all} />
    </div>
  );
}
