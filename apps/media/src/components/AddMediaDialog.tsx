import { useEffect, useState } from "react";
import {
  Button,
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
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { Search } from "lucide-react";
import { MEDIA_TYPES, mediaType, type MediaTypeId } from "../domain/mediaTypes";
import { ACQUISITION, type Acquisition } from "../domain/types";
import { addMedia, findByExternalKey, useMedia, useMediaSettings } from "../data/repo";
import type { WorkHit } from "../data/openlibrary";
import { describeLookup, lookupFor, resolveHit } from "../data/lookup";
import { Cover } from "./Cover";

const ACQ_LABEL: Record<Acquisition, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };

/**
 * Two steps: find (lookup for books/comics, otherwise manual), then the
 * Reason and tags. Acquisition is a folded-away detail, defaulting to Wanted;
 * items land on the To… shelf (ADR 0006 amendment).
 */
export function AddMediaDialog({ open, onOpenChange, defaultType = "book" }: { open: boolean; onOpenChange: (o: boolean) => void; defaultType?: MediaTypeId }) {
  const items = useMedia();
  const [type, setType] = useState<MediaTypeId>(defaultType);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WorkHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<WorkHit | null>(null);
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [year, setYear] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [acq, setAcq] = useState<Acquisition>("WANTED");
  const [tags, setTags] = useState<string[]>([]);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  const settings = useMediaSettings();
  const def = mediaType(type);
  const search = lookupFor(type, settings);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setQuery("");
    setHits([]);
    setPick(null);
    setManual(false);
    setTitle("");
    setCreator("");
    setYear("");
    setSize("");
    setReason("");
    setAcq("WANTED");
    setTags([]);
  }, [open, defaultType]);

  // Debounced lookup; last keystroke wins.
  useEffect(() => {
    if (!search || manual || query.trim().length < 3) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      search(query.trim(), ctl.signal)
        .then(setHits)
        .catch((err: Error) => {
          if (err.name !== "AbortError") toast.error("Lookup failed — add it manually");
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, type, settings, manual]); // `search` derives from type + settings


  async function choose(raw: WorkHit) {
    const dup = findByExternalKey(items, raw.externalKey);
    if (dup) {
      toast.warning(`Already on your list — ${ACQ_LABEL[dup.acquisition]}, ${mediaType(dup.type).engagement[dup.engagement]}`);
      return;
    }
    const h = await resolveHit(raw);
    setPick(h);
    setTitle(h.title);
    setCreator(h.creator);
    setYear(h.year ? String(h.year) : "");
    setSize(h.size ? String(h.size) : "");
  }

  const step2 = pick !== null || manual || !search;

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    await addMedia({
      type,
      title,
      creator,
      externalKey: pick?.externalKey ?? "",
      coverUrl: pick?.coverUrl ?? "",
      year: Number(year) || 0,
      size: Number(size) || 0,
      acquisition: acq,
      reason: reason.trim(),
      tags,
    });
    toast.success(`${title.trim()} added to ${def.wantLabel}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {def.label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Medium</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as MediaTypeId);
                setPick(null);
                setManual(false);
                setHits([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!step2 && (
            <div className="grid gap-2">
              <Label htmlFor="media-search">Search {describeLookup(type, settings)}</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input id="media-search" className="pl-8" value={query} autoFocus placeholder="Title or author (3+ letters)" onChange={(e) => setQuery(e.target.value)} />
              </div>
              {searching && <p className="text-muted-foreground text-xs">Searching…</p>}
              {hits.length > 0 && (
                <ul className="grid max-h-64 gap-1 overflow-y-auto">
                  {hits.map((h) => (
                    <li key={h.externalKey}>
                      <button type="button" className="hover:bg-accent flex w-full items-center gap-3 rounded-md border p-2 text-left" onClick={() => void choose(h)}>
                        <Cover item={{ title: h.title, coverUrl: h.coverUrl, type }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{h.title}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {h.creator}
                            {h.year ? ` · ${h.year}` : ""}
                            {h.size ? ` · ${h.size} ${def.sizeUnit}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="ghost" className="justify-start" onClick={() => setManual(true)}>
                Can't find it — enter manually
              </Button>
            </div>
          )}

          {step2 && (
            <>
              {pick && (
                <div className="flex items-center gap-3">
                  <Cover item={{ title: pick.title, coverUrl: pick.coverUrl, type }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{pick.title}</div>
                    <div className="text-muted-foreground truncate text-xs">{pick.creator}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPick(null)}>
                    Change
                  </Button>
                </div>
              )}
              {!pick && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="media-title">Title</Label>
                    <Input id="media-title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
                    <div className="grid gap-2">
                      <Label htmlFor="media-creator">{def.creatorLabel}</Label>
                      <Input id="media-creator" value={creator} onChange={(e) => setCreator(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="media-year">Year</Label>
                      <Input id="media-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="media-size" className="truncate">{def.sizeUnit}</Label>
                      <Input id="media-size" type="number" value={size} onChange={(e) => setSize(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="media-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id="media-reason" value={reason} autoFocus={!!pick} rows={3} placeholder="Who recommended it, or what made you want it. Future you will not remember." onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="media-tags">Tags</Label>
                <TagInput id="media-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
              </div>
              <details className="grid gap-2">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  More details{acq !== "WANTED" ? ` · ${ACQ_LABEL[acq]}` : ""}
                </summary>
                <div className="grid gap-2 pt-2">
                  <Label>Owned?</Label>
                  <Select value={acq} onValueChange={(v) => setAcq(v as Acquisition)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACQUISITION.filter((a) => a !== "GONE").map((a) => (
                        <SelectItem key={a} value={a}>
                          {ACQ_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </details>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step2 && <Button onClick={() => void submit()}>Add</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ACQ_LABEL };
