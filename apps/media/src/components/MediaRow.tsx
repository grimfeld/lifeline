import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@lifeline/ui";
import { AlertTriangle, ArrowDownToLine, BookOpenCheck, Check, GraduationCap, MoreHorizontal, Pencil, Play, ShoppingCart, Square, Trash2, X } from "lucide-react";
import { mediaType } from "../domain/mediaTypes";
import { ACQUISITION, type Acquisition, type MediaItem } from "../domain/types";
import { abandon, acquire, evict, finish, freeSlots, isBuySignal, isStale, promote, release, setStudied, slotAge, start } from "../domain/rules";
import { deleteMedia, patchMedia } from "../data/repo";
import { Cover } from "./Cover";
import { ACQ_LABEL } from "./AddMediaDialog";

export function EditMediaDialog({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [year, setYear] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [acq, setAcq] = useState<Acquisition>("WANTED");
  const [coverUrl, setCoverUrl] = useState("");
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCreator(item.creator);
    setYear(item.year ? String(item.year) : "");
    setSize(item.size ? String(item.size) : "");
    setReason(item.reason);
    setAcq(item.acquisition);
    setCoverUrl(item.coverUrl);
  }, [item]);
  if (!item) return null;
  const def = mediaType(item.type);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {def.label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            <div className="grid gap-2">
              <Label>{def.creatorLabel}</Label>
              <Input value={creator} onChange={(e) => setCreator(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label className="truncate">{def.sizeUnit}</Label>
              <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Cover URL</Label>
            <Input value={coverUrl} placeholder="https://…" onChange={(e) => setCoverUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Acquisition</Label>
            <Select value={acq} onValueChange={(v) => setAcq(v as Acquisition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACQUISITION.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACQ_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) return void toast.error("Title required");
              void patchMedia(item, {
                title: title.trim(),
                creator: creator.trim(),
                year: Number(year) || 0,
                size: Number(size) || 0,
                reason: reason.trim(),
                coverUrl: coverUrl.trim(),
                ...(acq !== item.acquisition ? (acq === "OWNED" || acq === "BORROWED" ? acquire(acq) : acq === "GONE" ? release() : { acquisition: acq }) : {}),
              });
              toast.success("Saved");
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One media item — on a slot or in the backlog — with its transitions. */
export function MediaRow({ item, all, onEdit, compact = false }: { item: MediaItem; all: MediaItem[]; onEdit: (m: MediaItem) => void; compact?: boolean }) {
  const def = mediaType(item.type);
  const slotted = item.slot > 0;
  const age = slotAge(item);
  const stale = isStale(item);
  const free = freeSlots(all, item.type);
  const buy = isBuySignal(item);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";

  const act = (label: string, patch: Parameters<typeof patchMedia>[1]) => () => {
    void patchMedia(item, patch);
    toast.success(label);
  };

  return (
    <div className={cn("bg-card flex items-center gap-3 rounded-lg border px-3 py-2", compact && "px-2 py-1.5")}>
      <Cover item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {slotted && <span className="text-muted-foreground shrink-0 text-xs">#{item.slot}</span>}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {item.creator}
          {item.year ? ` · ${item.year}` : ""}
          {!compact && item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </div>
        {!compact && item.reason && <div className="text-muted-foreground line-clamp-2 text-xs italic">{item.reason}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {buy && (
            <Badge variant="default" className="gap-1">
              <ShoppingCart className="size-3" /> buy this
            </Badge>
          )}
          {reading && <Badge>{def.engagement.IN_PROGRESS}</Badge>}
          {!slotted && !reading && <Badge variant="outline">{ACQ_LABEL[item.acquisition]}</Badge>}
          {!slotted && item.engagement !== "UNSTARTED" && !reading && <Badge variant="secondary">{def.engagement[item.engagement]}</Badge>}
          {item.studied && (
            <Badge variant="secondary" className="gap-1">
              <GraduationCap className="size-3" /> studied
            </Badge>
          )}
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
        <Button size="sm" variant="outline" className="shrink-0" disabled={free.length === 0} title={free.length === 0 ? `The ${def.plural.toLowerCase()} nightstand is full` : ""} onClick={act(`Slot ${free[0]} taken`, promote(free[0]))}>
          <ArrowDownToLine /> Slot it
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-7 shrink-0">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {slotted ? (
            <>
              {buy && (
                <DropdownMenuItem onClick={act("Got it", acquire("OWNED"))}>
                  <ShoppingCart /> Got it (owned)
                </DropdownMenuItem>
              )}
              {!reading && (
                <DropdownMenuItem onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
                  <Play /> {def.startVerb}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={act("Slot freed", finish())}>
                <Check /> {def.finishVerb}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={act("Abandoned — slot freed", abandon())}>
                <X /> Abandon
              </DropdownMenuItem>
              <DropdownMenuItem onClick={act("Back to the backlog", evict())}>
                <Square /> Back to backlog
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {!done && (
                <DropdownMenuItem disabled={free.length === 0} onClick={act(`Slot ${free[0]} taken`, promote(free[0]))}>
                  <ArrowDownToLine /> Slot it{free.length === 0 ? " (full)" : ""}
                </DropdownMenuItem>
              )}
              {item.acquisition === "WANTED" && (
                <DropdownMenuItem onClick={act("Owned", acquire("OWNED"))}>
                  <ShoppingCart /> Got it (owned)
                </DropdownMenuItem>
              )}
              {done && (
                <DropdownMenuItem onClick={act("Back to unstarted", { engagement: "UNSTARTED", finishedOn: "", startedOn: "" })}>
                  <BookOpenCheck /> Mark {def.engagement.UNSTARTED.toLowerCase()} again
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={act(item.studied ? "Studied mark removed" : "Marked studied", setStudied(!item.studied))}>
            <GraduationCap /> {item.studied ? "Unmark studied" : "Mark studied"}
          </DropdownMenuItem>
          {item.acquisition !== "GONE" && (
            <DropdownMenuItem onClick={act("Gone", release())}>
              <X /> Gone (sold / returned / given away)
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void deleteMedia(item.id);
              toast.success("Deleted");
            }}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
