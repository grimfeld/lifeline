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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChips,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { AlertTriangle, ArrowDownToLine, Check, GraduationCap, Play, ShoppingCart } from "lucide-react";
import { mediaType } from "../domain/mediaTypes";
import { ACQUISITION, type Acquisition, type MediaItem } from "../domain/types";
import { acquire, finish, freeSlots, isBuySignal, isStale, promote, release, slotAge, start } from "../domain/rules";
import { patchMedia } from "../data/repo";
import { Cover } from "./Cover";
import { MediaActionsMenu, useAct } from "./MediaActions";
import { ACQ_LABEL } from "./AddMediaDialog";
import { displayTitle, docHref, normalizeTag, useLinkIndex, useTagVocabulary } from "@lifeline/core";

/** Documents mentioning this item via [[wikilink]] (ADR 0018). Muted, read-only. */
function MentionedIn({ itemId }: { itemId: string }) {
  const index = useLinkIndex();
  const links = index.backlinksTo(itemId);
  if (links.length === 0) return null;
  return (
    <div className="text-muted-foreground grid gap-1 text-xs">
      <span>
        Mentioned in {links.length} {links.length === 1 ? "document" : "documents"}
      </span>
      <ul className="grid gap-0.5">
        {links.map((l) => {
          const src = index.byId.get(l.sourceId);
          if (!src) return null;
          return (
            <li key={`${l.sourceId}/${l.field ?? ""}`}>
              <a href={docHref(src)} className="underline-offset-2 hover:underline">
                {displayTitle(src)}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EditMediaDialog({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [year, setYear] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [acq, setAcq] = useState<Acquisition>("WANTED");
  const [coverUrl, setCoverUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCreator(item.creator);
    setYear(item.year ? String(item.year) : "");
    setSize(item.size ? String(item.size) : "");
    setReason(item.reason);
    setAcq(item.acquisition);
    setCoverUrl(item.coverUrl);
    setTags(item.tags ?? []);
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
            <Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="media-edit-tags">Tags</Label>
            <TagInput id="media-edit-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
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
          <MentionedIn itemId={item.id} />
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
                tags,
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

  const act = useAct(item);

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

      <MediaActionsMenu item={item} all={all} onEdit={onEdit} />
    </div>
  );
}
