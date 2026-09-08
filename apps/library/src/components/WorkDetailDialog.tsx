import { Badge, Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle, TagChips } from "@lifeline/ui";
import { AlertTriangle, ArrowDownToLine, MoreHorizontal, Play, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { freeSlots, isBuySignal, isStale, promote, slotAge, start } from "../domain/rules";
import { Cover } from "./Cover";
import { ACQ_LABEL } from "./AddWorkDialog";
import { QuickActionsRow } from "./QuickActions";
import { WorkActionsMenu, useAct } from "./WorkActions";
import { useState } from "react";
import { toast } from "@lifeline/ui";
import { useLookupSettings } from "../data/repo";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "./FindMetadataDialog";
import { AuthorNames } from "./AuthorNames";

/** "Find metadata" / "Refresh from source" — the lookup row under the header (ADR 0006 amendment). */
function LookupActions({ item }: { item: Work }) {
  const settings = useLookupSettings();
  const [finding, setFinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLookup = lookupFor(item.type, settings) !== null;
  if (!hasLookup) return null;

  async function refresh() {
    setRefreshing(true);
    try {
      const patch = await refreshFromSource(item, settings);
      if (patch === null) toast.warning("No matching source entry found");
      else toast.success(Object.keys(patch).length ? "Refreshed from source" : "Already up to date");
    } catch (e) {
      toast.error((e as Error).message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setFinding(true)}>
        <Search className="size-3" /> Find metadata
      </Button>
      {item.externalKey && (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw className={cn("size-3", refreshing && "animate-spin")} /> Refresh from source
        </Button>
      )}
      {finding && <FindMetadataDialog item={item} onClose={() => setFinding(false)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * The place to look at one item and act on it: big cover, both axes, the
 * dates, the reason, and the same transitions the list row offers.
 */
export function WorkDetailDialog({ item, all, onClose, onEdit }: { item: Work | null; all: Work[]; onClose: () => void; onEdit: (m: Work) => void }) {
  if (!item) return null;
  const def = workType(item.type);
  const slotted = item.slot > 0;
  const free = freeSlots(all, item.type);
  const buy = isBuySignal(item);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";
  const age = slotAge(item);
  const stale = isStale(item);
  const act = useAct(item);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <Cover item={item} size="fill" className="self-start rounded-md border shadow" />
          <div className="grid content-start gap-3">
            <div>
              <div className="flex items-start gap-2">
                <h2 className="text-lg leading-tight font-semibold">{item.title}</h2>
                {slotted && <span className="text-muted-foreground mt-1 shrink-0 text-xs">#{item.slot}</span>}
              </div>
              <div className="text-muted-foreground text-sm">
                <AuthorNames item={item} />
                {item.year ? `${item.authors.length ? " · " : ""}${item.year}` : ""}
                {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline">{def.label}</Badge>
              <Badge variant="outline">{ACQ_LABEL[item.acquisition]}</Badge>
              <Badge variant={reading ? "default" : "secondary"}>{def.engagement[item.engagement]}</Badge>
              {buy && (
                <Badge variant="default" className="gap-1">
                  <ShoppingCart className="size-3" /> buy this
                </Badge>
              )}
              {slotted && age !== null && (
                <span className={cn("flex items-center gap-1 text-xs", stale ? "text-destructive" : "text-muted-foreground")}>
                  {stale && <AlertTriangle className="size-3" />}
                  {age}d in this slot
                </span>
              )}
            </div>

            <QuickActionsRow item={item} />

            {(item.tags ?? []).length > 0 && <TagChips tags={item.tags} size="xs" />}

            <LookupActions item={item} />

            {item.reason && <p className="text-muted-foreground text-sm italic">{item.reason}</p>}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Added">{item.addedOn || "—"}</Field>
              <Field label="Acquired">{item.acquiredOn || "—"}</Field>
              <Field label="Started">{item.startedOn || "—"}</Field>
              <Field label="Finished">{item.finishedOn || "—"}</Field>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {slotted ? (
            !reading &&
            item.acquisition !== "WANTED" && (
              <Button size="sm" variant="outline" onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
                <Play /> {def.startVerb}
              </Button>
            )
          ) : (
            !done && (
              <Button size="sm" variant="outline" disabled={free.length === 0} title={free.length === 0 ? `The ${def.plural.toLowerCase()} nightstand is full` : ""} onClick={act(`Slot ${free[0]} taken`, promote(free[0]))}>
                <ArrowDownToLine /> Slot it
              </Button>
            )
          )}
          <WorkActionsMenu
            item={item}
            all={all}
            onEdit={(m) => {
              onClose();
              onEdit(m);
            }}
            onDeleted={onClose}
            trigger={
              <Button size="sm" variant="ghost">
                <MoreHorizontal /> More
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
