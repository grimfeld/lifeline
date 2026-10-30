import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { docHref } from "@lifeline/core";
import { Button, Checkbox, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { ArrowLeft, ExternalLink, FileText, GitMerge, MoreHorizontal, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { foldBibliography, ownedByKey, type BibliographyRow } from "../domain/authors";
import type { Author, Work } from "../domain/types";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { deleteAuthor, patchAuthor, restoreAuthor, useAuthor, useWorks } from "../data/repo";
import { addFromBibliography, fetchBibliography, refreshAuthor } from "../data/authorActions";
import { olAuthorId } from "../data/openlibrary";
import { APP_HREF } from "../constants";
import { Cover } from "../components/Cover";
import { WorkRow } from "../components/WorkRow";
import { AuthorCandidatesDialog } from "../components/AuthorCandidatesDialog";
import { MergeAuthorDialog } from "../components/MergeAuthorDialog";
import { ACQ_LABEL } from "../components/AddWorkDialog";

const SHELF_ORDER: Work["engagement"][] = ["IN_PROGRESS", "UNSTARTED", "DONE", "ABANDONED"];
const SHELF_LABEL: Record<Work["engagement"], string> = { IN_PROGRESS: "Reading", UNSTARTED: "To read", DONE: "Read", ABANDONED: "Dropped" };

/** Name and aliases, the two things the Library edits on an Author; everything else is Open Library's or the Vault's. */
function EditAuthorDialog({ author, onClose }: { author: Author | null; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  useEffect(() => {
    if (!author) return;
    setTitle(author.title);
    setAliases(author.aliases);
  }, [author]);
  if (!author) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit author</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="author-name">Name</Label>
            <Input id="author-name" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="author-aliases">Aliases</Label>
            <TagInput id="author-aliases" value={aliases} onChange={setAliases} placeholder="Other names…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) return void toast.error("Name required");
              void patchAuthor(author.id, { title: title.trim(), aliases });
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

/**
 * The Bibliography (CONTEXT.md, ADR 0052): fetched on open, never stored.
 * Rows already on the shelf say so; the rest are ticked and added to
 * To read as Wanted, in the medium chosen here.
 */
function Bibliography({ author, works }: { author: Author; works: Work[] }) {
  const [rows, setRows] = useState<BibliographyRow[] | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const mine = works.filter((w) => w.authors.includes(author.id));
  const defaultMedium = (mine.filter((w) => w.type === "comic").length > mine.length / 2 ? "comic" : "book") as WorkTypeId;
  const [medium, setMedium] = useState<WorkTypeId>(defaultMedium);

  useEffect(() => {
    if (!author.externalKey) return;
    setRows(null);
    setError("");
    setTicked(new Set());
    const ctl = new AbortController();
    fetchBibliography(author, ctl.signal)
      .then(setRows)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(navigator.onLine ? e.message || "Could not fetch" : "Offline — no bibliography");
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the Author's identity or key changes, not on every edit of the record
  }, [author.id, author.externalKey]);

  // Hundreds of rows against the whole shelf: one key index and one fold per change, not per row or render.
  const owned = useMemo(() => ownedByKey(works), [works]);
  const folded = useMemo(() => (rows ? foldBibliography(rows, false) : []), [rows]);
  const shown = useMemo(() => (rows ? (showAll ? foldBibliography(rows, true) : folded) : []), [rows, showAll, folded]);
  const hidden = rows ? rows.length - folded.length : 0;
  const tickable = useMemo(() => shown.filter((r) => !owned.has(r.externalKey)), [shown, owned]);

  async function add() {
    const picked = shown.filter((r) => ticked.has(r.externalKey) && !owned.has(r.externalKey));
    if (!picked.length) return;
    setAdding(true);
    try {
      await addFromBibliography(author, picked, medium);
      toast.success(`${picked.length} added to ${workType(medium).wantLabel}`);
      setTicked(new Set());
    } catch (e) {
      toast.error((e as Error).message || "Could not add");
    } finally {
      setAdding(false);
    }
  }

  if (!author.externalKey) {
    return <p className="text-muted-foreground text-sm">No bibliography until this author is resolved to Open Library — use “Find on Open Library” above.</p>;
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          {rows === null && !error && "Fetching from Open Library…"}
          {rows && `${shown.length} works${hidden && !showAll ? ` · ${hidden} folded` : ""} · not stored, fetched now`}
          {error && <span className="text-destructive">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          {hidden > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Fold duplicates" : "Show all"}
            </Button>
          )}
          {tickable.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setTicked(ticked.size === tickable.length ? new Set() : new Set(tickable.map((r) => r.externalKey)))}
            >
              {ticked.size === tickable.length ? "Untick all" : "Tick all"}
            </Button>
          )}
        </div>
      </div>
      {rows && rows.length === 0 && <p className="text-muted-foreground text-sm">Open Library lists nothing under this author.</p>}
      {shown.length > 0 && (
        <ul className="grid gap-1">
          {shown.map((r) => {
            const have = owned.get(r.externalKey);
            const on = ticked.has(r.externalKey);
            return (
              <li key={r.externalKey}>
                <label className={cn("hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md border p-2", have && "opacity-70")}>
                  <Checkbox
                    checked={have ? true : on}
                    disabled={!!have}
                    onCheckedChange={(c) =>
                      setTicked((s) => {
                        const n = new Set(s);
                        if (c === true) n.add(r.externalKey);
                        else n.delete(r.externalKey);
                        return n;
                      })
                    }
                  />
                  <Cover item={{ title: r.title, coverUrl: r.coverUrl, type: medium }} className="h-12 w-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {r.year || "—"}
                      {have ? ` · on your shelf — ${ACQ_LABEL[have.acquisition]}, ${workType(have.type).engagement[have.engagement]}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {ticked.size > 0 && (
        <div className="bg-background sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t py-2">
          <Select value={medium} onValueChange={(v) => setMedium(v as WorkTypeId)}>
            <SelectTrigger className="h-8 w-28 text-xs" aria-label="Medium">
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
          <Button size="sm" disabled={adding} onClick={() => void add()}>
            Add {ticked.size} to {workType(medium).wantLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The Author's page in the Library (ADR 0052): who they are, what of theirs
 * is on my shelves, and their Bibliography. Resolve, refresh, merge, edit and
 * delete live in the menu; the body is written on the Vault page.
 */
export function AuthorScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const author = useAuthor(id);
  const works = useWorks();
  const [finding, setFinding] = useState(false);
  const [merging, setMerging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!author) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-3 p-6">
        <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="size-4" /> Library
        </Link>
        <p className="text-muted-foreground text-sm">No such author.</p>
      </div>
    );
  }

  const mine = works.filter((w) => w.authors.includes(author.id));
  const byShelf = SHELF_ORDER.map((s) => ({ shelf: s, rows: mine.filter((w) => w.engagement === s) })).filter((g) => g.rows.length);
  const years = [author.born, author.died].filter(Boolean).join(" – ");
  const olid = olAuthorId(author.externalKey);

  async function refresh() {
    if (!author) return;
    setRefreshing(true);
    try {
      toast.success((await refreshAuthor(author)) ? "Refreshed from Open Library" : "Already up to date");
    } catch (e) {
      toast.error((e as Error).message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove() {
    if (!author) return;
    const gone = author;
    const unlinked = await deleteAuthor(gone.id);
    toast.success(`Deleted “${gone.title}”`, {
      description: unlinked.length ? `Their ${unlinked.length} work${unlinked.length === 1 ? "" : "s"} stay, unlinked.` : undefined,
      action: { label: "Undo", onClick: () => void restoreAuthor(gone, unlinked) },
    });
    navigate(APP_HREF);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 p-6">
      <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Library
      </Link>

      <header className="flex items-start gap-4">
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="size-24 shrink-0 rounded-md border object-cover shadow" loading="lazy" />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-md border text-2xl">{author.title.slice(0, 1)}</div>
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{author.title}</h1>
          <div className="text-muted-foreground text-sm">
            {years || (author.externalKey ? "" : "Unresolved — not yet matched to Open Library")}
            {years && author.aliases.length ? " · " : ""}
            {author.aliases.length > 0 && <span>also {author.aliases.join(", ")}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {!author.externalKey && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setFinding(true)}>
                <Search className="size-3" /> Find on Open Library
              </Button>
            )}
            {author.externalKey && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={refreshing} onClick={() => void refresh()}>
                <RefreshCw className={cn("size-3", refreshing && "animate-spin")} /> Refresh
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
              <Link to={docHref(author)}>
                <FileText className="size-3" /> Open in Vault
              </Link>
            </Button>
            {olid && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                <a href={`https://openlibrary.org/authors/${olid}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" /> Open Library
                </a>
              </Button>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil /> Edit name and aliases
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFinding(true)}>
              <Search /> {author.externalKey ? "Re-match on Open Library" : "Find on Open Library"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMerging(true)}>
              <GitMerge /> Merge…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => void remove()}>
              <Trash2 /> Delete author
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <section className="grid gap-2" aria-label="On my shelves">
        <h2 className="text-muted-foreground text-sm font-medium">
          On my shelves · <span className="tabular-nums">{mine.length}</span>
        </h2>
        {mine.length === 0 && <p className="text-muted-foreground text-sm">Nothing by them yet — tick something below.</p>}
        {byShelf.map((g) => (
          <div key={g.shelf} className="grid gap-1.5">
            <h3 className="text-muted-foreground text-xs uppercase tracking-wide">{SHELF_LABEL[g.shelf]}</h3>
            {g.rows.map((w) => (
              <WorkRow key={w.id} item={w} all={works} compact />
            ))}
          </div>
        ))}
      </section>

      <section className="grid gap-2" aria-label="Bibliography">
        <h2 className="text-muted-foreground text-sm font-medium">Bibliography</h2>
        <Bibliography author={author} works={works} />
      </section>

      <AuthorCandidatesDialog author={finding ? author : null} onClose={() => setFinding(false)} />
      <MergeAuthorDialog
        author={merging ? author : null}
        onClose={() => setMerging(false)}
        onMerged={(survivorId) => {
          setMerging(false);
          if (survivorId !== author.id) navigate(`${APP_HREF}/authors/${survivorId}`, { replace: true });
        }}
      />
      <EditAuthorDialog author={editing ? author : null} onClose={() => setEditing(false)} />
    </div>
  );
}
