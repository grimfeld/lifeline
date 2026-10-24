import { Badge, Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle, TagChips, Textarea, toast } from "@lifeline/ui";
import { ListPlus, MoreHorizontal, Pencil, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PartsSection } from "@lifeline/parts";
import { discothequeParts } from "../parts";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { setReview, start } from "../domain/rules";
import { playlistsWith } from "../domain/playlist";
import { Cover } from "./Cover";
import { actOn, WorkActionsMenu } from "./WorkActions";
import { MarksRow } from "./Marks";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { patchWork, usePlaylists } from "../data/repo";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "./FindMetadataDialog";

/** MusicBrainz is keyless — one stable empty-keys object (stable for effect deps). */
const NO_KEYS = {};

/** "Find metadata" / "Refresh from source" — the lookup row under the header. */
function LookupActions({ item }: { item: Work }) {
  const settings = NO_KEYS;
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

/** The Review (ADR 0035): the body, read as written; "Write" / "Edit" opens it in place. */
function Review({ item }: { item: Work }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body ?? "");
  useEffect(() => setDraft(item.body ?? ""), [item.id, item.body]);
  const body = (item.body ?? "").trim();

  if (editing) {
    return (
      <div className="grid gap-2">
        <Textarea autoFocus rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What did you make of it? Markdown, [[links]] and #tags all count." />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setDraft(item.body ?? ""); setEditing(false); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void patchWork(item, setReview(draft));
              setEditing(false);
              toast.success(draft.trim() ? "Review saved" : "Review cleared");
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-[11px] tracking-wide uppercase">Review</div>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}>
          <Pencil className="size-3" /> {body ? "Edit" : "Write"}
        </Button>
      </div>
      {body ? <p className="text-sm whitespace-pre-wrap">{body}</p> : <p className="text-muted-foreground text-sm italic">Nothing written yet.</p>}
    </div>
  );
}

/** "In playlists: …" with the way to add more. */
function Playlists({ item }: { item: Work }) {
  const inLists = playlistsWith(usePlaylists(), item.id);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {inLists.length > 0 && (
        <span className="text-muted-foreground">
          In {inLists.map((p) => p.title).join(", ")}
        </span>
      )}
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setOpen(true)}>
        <ListPlus className="size-3" /> Add to playlist…
      </Button>
      <AddToPlaylistDialog item={item} open={open} onOpenChange={setOpen} />
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

/** The place to look at one item and act on it: big cover, the axes, the dates, the reason. */
export function WorkDetailDialog({ item, all: _all, onClose, onEdit }: { item: Work | null; all?: Work[]; onClose: () => void; onEdit: (m: Work) => void }) {
  if (!item) return null;
  const def = workType(item.type);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";
  const act = actOn(item);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <Cover item={item} size="fill" className="self-start rounded-md border shadow" />
          <div className="grid content-start gap-3">
            <div>
              <h2 className="text-lg leading-tight font-semibold">{item.title}</h2>
              <div className="text-muted-foreground text-sm">
                {item.creator}
                {item.year ? ` · ${item.year}` : ""}
                {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={reading ? "default" : "secondary"}>{def.engagement[item.engagement]}</Badge>
            </div>

            <MarksRow item={item} />

            {(item.tags ?? []).length > 0 && <TagChips tags={item.tags} size="xs" />}

            <LookupActions item={item} />

            {item.reason && <p className="text-muted-foreground text-sm italic">{item.reason}</p>}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Added">{item.addedOn || "—"}</Field>
              <Field label="Started">{item.startedOn || "—"}</Field>
              <Field label="Finished">{item.finishedOn || "—"}</Field>
            </div>

            <Playlists item={item} />
          </div>
        </div>

        <PartsSection kit={discothequeParts} work={item} />

        <Review item={item} />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {!reading && !done && (
            <Button size="sm" variant="outline" onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
              <Play /> {def.startVerb}
            </Button>
          )}
          <WorkActionsMenu
            item={item}
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
