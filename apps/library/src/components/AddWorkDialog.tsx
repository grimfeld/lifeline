import { useEffect, useMemo, useRef, useState } from "react";
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
import { X } from "lucide-react";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { ACQUISITION, type Acquisition } from "../domain/types";
import { addWork, ensureAuthorRefs, findByExternalKey, useAuthorIndex, useWorks, useLookupSettings } from "../data/repo";
import { hitByline, PAGE_SIZE, type AuthorRef, type LookupQuery, type WorkHit } from "../data/openlibrary";
import { describeLookup, lookupFor, providerOf, resolveHit } from "../data/lookup";
import { Cover } from "./Cover";
import { AuthorPicker } from "./AuthorPicker";

const ACQ_LABEL: Record<Acquisition, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };

/**
 * Two steps: find (lookup for books/comics, otherwise manual), then the
 * Reason and tags. Acquisition is a folded-away detail, defaulting to Wanted;
 * items land on the To… shelf (ADR 0006 amendment). The find step asks Title
 * and Author apart (ADR 0052): either alone searches, a picked Author narrows
 * to their key and links the Work, and an Author with no Title is their
 * bibliography by another door. Twenty hits, "More" pages the provider that
 * answered.
 */
export function AddWorkDialog({ open, onOpenChange, defaultType = "book" }: { open: boolean; onOpenChange: (o: boolean) => void; defaultType?: WorkTypeId }) {
  const items = useWorks();
  const authorIndex = useAuthorIndex();
  const [type, setType] = useState<WorkTypeId>(defaultType);
  const [title, setTitle] = useState("");
  const [authorText, setAuthorText] = useState("");
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const [hits, setHits] = useState<WorkHit[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<WorkHit | null>(null);
  /** The picked hit's authors, shown as chips and found-or-created on Add — removable before then. */
  const [hitAuthors, setHitAuthors] = useState<AuthorRef[]>([]);
  const [manual, setManual] = useState(false);
  const [year, setYear] = useState("");
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [acq, setAcq] = useState<Acquisition>("WANTED");
  const [tags, setTags] = useState<string[]>([]);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  const settings = useLookupSettings();
  const def = workType(type);
  const search = lookupFor(type, settings);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setTitle("");
    setAuthorText("");
    setAuthorIds([]);
    setHits([]);
    setPage(1);
    setMore(false);
    setPick(null);
    setHitAuthors([]);
    setManual(false);
    setYear("");
    setSize("");
    setReason("");
    setAcq("WANTED");
    setTags([]);
  }, [open, defaultType]);

  // The picked Author narrows the search: by key when resolved, by name otherwise.
  const pickedAuthor = authorIds[0] ? authorIndex.get(authorIds[0]) : undefined;
  const query = useMemo<LookupQuery | null>(() => {
    const t = title.trim();
    const a = pickedAuthor ? pickedAuthor.title : authorText.trim();
    if (t.length < 3 && !pickedAuthor && a.length < 3) return null;
    return { ...(t ? { title: t } : {}), ...(a ? { author: a } : {}), ...(pickedAuthor?.externalKey ? { authorKey: pickedAuthor.externalKey } : {}) };
  }, [title, authorText, pickedAuthor]);

  // A "More" in flight belongs to the query it was asked for.
  const moreCtl = useRef<AbortController | null>(null);

  // Debounced lookup; last keystroke wins. A new query starts at page one,
  // and drops the old query's "More" so its rows never land under the new hits.
  useEffect(() => {
    if (moreCtl.current) {
      moreCtl.current.abort();
      moreCtl.current = null;
      setSearching(false);
    }
    if (!search || manual || !query) {
      setHits([]);
      setMore(false);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      search({ ...query, page: 1 }, ctl.signal)
        .then((res) => {
          setHits(res);
          setPage(1);
          setMore(res.length >= PAGE_SIZE);
        })
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

  async function loadMore() {
    const firstHit = hits[0];
    if (!search || !query || !firstHit) return;
    const next = page + 1;
    moreCtl.current?.abort();
    const ctl = new AbortController();
    moreCtl.current = ctl;
    setSearching(true);
    try {
      const res = await search({ ...query, page: next, provider: providerOf(firstHit) }, ctl.signal);
      if (ctl.signal.aborted) return;
      setHits((h) => [...h, ...res.filter((r) => !h.some((x) => x.externalKey === r.externalKey))]);
      setPage(next);
      setMore(res.length >= PAGE_SIZE);
    } catch (e) {
      if (!ctl.signal.aborted) toast.error((e as Error).message || "Lookup failed");
    } finally {
      if (moreCtl.current === ctl) {
        moreCtl.current = null;
        setSearching(false);
      }
    }
  }

  async function choose(raw: WorkHit) {
    const dup = findByExternalKey(items, raw.externalKey);
    if (dup) {
      toast.warning(`Already on your list — ${ACQ_LABEL[dup.acquisition]}, ${workType(dup.type).engagement[dup.engagement]}`);
      return;
    }
    const h = await resolveHit(raw);
    setPick(h);
    setTitle(h.title);
    setHitAuthors(h.authors);
    setYear(h.year ? String(h.year) : "");
    setSize(h.size ? String(h.size) : "");
  }

  const step2 = pick !== null || manual || !search;

  // One add per press: a second press while the first awaits the store would add a twin.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const fromHit = await ensureAuthorRefs(hitAuthors);
      const authors = [...new Set([...authorIds, ...fromHit])];
      await addWork({
        medium: type,
        title,
        authors,
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
    } catch (e) {
      toast.error((e as Error).message || "Could not add it");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /** Chips for the Authors the Work will get: the picked ones and the hit's, each removable. */
  const authorChips = (
    <div className="flex flex-wrap gap-1">
      {authorIds.map((id) => (
        <span key={id} className="bg-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs">
          {authorIndex.get(id)?.title ?? "…"}
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Remove author" onClick={() => setAuthorIds((a) => a.filter((x) => x !== id))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {hitAuthors.map((a, i) => (
        <span key={`${a.externalKey ?? a.name}-${i}`} className="bg-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs" title={a.externalKey ? "From Open Library" : "Name only"}>
          {a.name}
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${a.name}`} onClick={() => setHitAuthors((l) => l.filter((_, j) => j !== i))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {authorIds.length + hitAuthors.length === 0 && <span className="text-muted-foreground text-xs">No author</span>}
    </div>
  );

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
                setType(v as WorkTypeId);
                setPick(null);
                setHitAuthors([]);
                setManual(false);
                setHits([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!step2 && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-xs">Search {describeLookup(type, settings)} — title, author, or both.</p>
              <div className="grid gap-2">
                <Label htmlFor="media-title-search">Title</Label>
                <Input id="media-title-search" value={title} autoFocus placeholder="Title (3+ letters)" onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="media-author-search">{def.creatorLabel}</Label>
                <AuthorPicker id="media-author-search" value={authorIds} onChange={setAuthorIds} text={authorText} onTextChange={setAuthorText} placeholder="Author — yours first, then Open Library" />
              </div>
              {searching && hits.length === 0 && <p className="text-muted-foreground text-xs">Searching…</p>}
              {hits.length > 0 && (
                <ul className="grid max-h-72 gap-1 overflow-y-auto">
                  {hits.map((h) => (
                    <li key={h.externalKey}>
                      <button type="button" className="hover:bg-accent flex w-full items-center gap-3 rounded-md border p-2 text-left" onClick={() => void choose(h)}>
                        <Cover item={{ title: h.title, coverUrl: h.coverUrl, type }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{h.title}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {hitByline(h)}
                            {h.year ? ` · ${h.year}` : ""}
                            {h.size ? ` · ${h.size} ${def.sizeUnit}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {more && (
                    <li>
                      <Button variant="outline" size="sm" className="w-full" disabled={searching} onClick={() => void loadMore()}>
                        {searching ? "Loading…" : "More"}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
              {!searching && query && hits.length === 0 && <p className="text-muted-foreground text-xs">Nothing found.</p>}
              <Button variant="ghost" className="justify-start" onClick={() => setManual(true)}>
                Can't find it — enter manually
              </Button>
            </div>
          )}

          {step2 && (
            <>
              {pick && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-3">
                    <Cover item={{ title: pick.title, coverUrl: pick.coverUrl, type }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{pick.title}</div>
                      <div className="text-muted-foreground truncate text-xs">{[pick.year || "", pick.size ? `${pick.size} ${def.sizeUnit}` : ""].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPick(null);
                        setHitAuthors([]);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                  {authorChips}
                </div>
              )}
              {!pick && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="media-title">Title</Label>
                    <Input id="media-title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="media-authors">{def.creatorLabel}</Label>
                    <AuthorPicker id="media-authors" value={authorIds} onChange={setAuthorIds} placeholder="Add an author…" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
          {step2 && (
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Adding…" : "Add"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ACQ_LABEL };
