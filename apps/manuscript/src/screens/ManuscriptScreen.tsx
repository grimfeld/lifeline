import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Button, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetTitle, cn, toast } from "@lifeline/ui";
import { documentType, useDocument, useLinkIndex, type Document } from "@lifeline/core";
import { DocumentEditor, MarkdownView } from "@lifeline/editor";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpenText, Expand, ListTree, Plus, RotateCcw, Scissors, Shrink, Trash2 } from "lucide-react";
import { addChapter, cutToOuttake, deleteOuttake, moveChapterBy, restoreOuttake, useChapters, useOuttakes } from "../data/repo";
import { wordCount } from "../domain/order";
import { SHELF_HREF, type Chapter, type Manuscript } from "../domain/types";

const PLAN = "plan";
const OUTTAKES = "outtakes";

/** The binder: the plan, the Chapters in order, the Outtakes. */
function Binder({ manuscript, chapters, outtakes, current, onPick }: { manuscript: Manuscript; chapters: Chapter[]; outtakes: number; current: string; onPick: (k: string) => void }) {
  const total = chapters.reduce((n, c) => n + wordCount(c.body ?? ""), 0);
  const row = (active: boolean) => cn("flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50");
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2" aria-label="Binder">
      <div className="grid gap-0.5 px-2 pt-1">
        <Link to={SHELF_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
          <ArrowLeft className="size-3" /> Manuscripts
        </Link>
        <span className="font-serif text-base leading-snug [overflow-wrap:anywhere]">{manuscript.title}</span>
        <span className="text-muted-foreground text-xs tabular-nums">{total.toLocaleString()} words</span>
      </div>
      <button type="button" className={row(current === PLAN)} onClick={() => onPick(PLAN)}>
        <ListTree className="size-4 shrink-0" /> Outline & plan
      </button>
      <div className="grid gap-0.5">
        <div className="text-muted-foreground px-2 text-xs font-medium">Chapters</div>
        {chapters.map((c, i) => (
          <div key={c.id} className="group flex min-w-0 items-center">
            <button type="button" className={cn(row(current === c.id), "flex-1")} onClick={() => onPick(c.id)}>
              <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">{wordCount(c.body ?? "")}</span>
            </button>
            <div className="flex shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <Button size="icon" variant="ghost" className="size-6" disabled={i === 0} aria-label={`Move ${c.title} up`} onClick={() => void moveChapterBy(manuscript.id, c.id, -1)}>
                <ArrowUp className="size-3" />
              </Button>
              <Button size="icon" variant="ghost" className="size-6" disabled={i === chapters.length - 1} aria-label={`Move ${c.title} down`} onClick={() => void moveChapterBy(manuscript.id, c.id, 1)}>
                <ArrowDown className="size-3" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="text-muted-foreground h-7 justify-start" onClick={() => void addChapter(manuscript.id).then((c) => onPick(c.id)).catch((e: Error) => toast.error(e.message))}>
          <Plus /> Chapter
        </Button>
      </div>
      <button type="button" className={row(current === OUTTAKES)} onClick={() => onPick(OUTTAKES)}>
        <Scissors className="size-4 shrink-0" /> Outtakes <span className="text-muted-foreground ml-auto text-xs tabular-nums">{outtakes}</span>
      </button>
    </nav>
  );
}

/** Cut passages kept with the Manuscript, each restorable to a Chapter's end. */
function OuttakesView({ manuscriptId, chapters, current }: { manuscriptId: string; chapters: Chapter[]; current?: string }) {
  const outtakes = useOuttakes(manuscriptId);
  const index = useLinkIndex();
  const [into, setInto] = useState(current ?? chapters[0]?.id ?? "");
  const title = (id: string) => chapters.find((c) => c.id === id)?.title;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3 p-4 md:p-6">
      <div className="grid gap-1">
        <h1 className="text-lg font-semibold">Outtakes</h1>
        <p className="text-muted-foreground text-sm">What you cut, kept — select a passage in a Chapter and press the scissors to put it here.</p>
      </div>
      {outtakes.length > 0 && chapters.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0">Restore into</span>
          <Select value={into} onValueChange={setInto}>
            <SelectTrigger className="h-8 min-w-0 flex-1" aria-label="Restore into">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {outtakes.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Nothing cut yet.</p>
      ) : (
        outtakes.map((o) => (
          <div key={o.id} className="group grid gap-1 rounded-lg border p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {title(o.chapterId) ? `from ${title(o.chapterId)}` : "cut"} · {new Date(o.cutAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </span>
              <Button size="sm" variant="ghost" className="h-6" disabled={!into} onClick={() => void restoreOuttake(o.id, into).then(() => toast.success("Restored at the end of the chapter"))}>
                <RotateCcw className="size-3" /> Restore
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive size-6" aria-label="Delete outtake" onClick={() => void deleteOuttake(o.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
            <div className="font-serif text-sm">
              <MarkdownView body={o.body} index={index} compact />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * /app/manuscripts/m/:id — a Manuscript written without distraction (ADR
 * 0068): the binder on the left (the plan, the Chapters in order, the
 * Outtakes), the page in the middle, and Focus to take everything else away.
 */
export function ManuscriptScreen() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const manuscript = useDocument<Manuscript>(id);
  const chapters = useChapters(id);
  const outtakes = useOuttakes(id);
  const index = useLinkIndex();
  const current = params.get("c") ?? PLAN;
  const [binder, setBinder] = useState(false);
  const [focus, setFocus] = useState(false);
  const openId = current === PLAN ? id : current === OUTTAKES ? "" : current;
  const doc = useDocument<Document>(openId || undefined);
  const pick = (k: string) => {
    setParams(k === PLAN ? {} : { c: k }, { replace: true });
    setBinder(false);
  };
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);
  const isChapter = useMemo(() => chapters.some((c) => c.id === current), [chapters, current]);

  if (!manuscript) return <div className="text-muted-foreground p-6 text-sm">This manuscript isn't here — it may have been deleted, or it lives in another Workspace.</div>;

  function cut() {
    const sel = window.getSelection()?.toString() ?? "";
    if (!sel.trim()) return void toast.message("Select the passage to cut first");
    void cutToOuttake(current, sel)
      .then(() => toast.success("Cut to the Outtakes", { action: { label: "See", onClick: () => pick(OUTTAKES) } }))
      .catch((e: Error) => toast.error(e.message));
  }

  const tools = (
    <>
      {isChapter && (
        <Button size="icon" variant="ghost" className="size-8" title="Cut the selection to the Outtakes" aria-label="Cut to outtakes" onMouseDown={(e) => e.preventDefault()} onClick={cut}>
          <Scissors />
        </Button>
      )}
      <Button size="icon" variant="ghost" className="size-8" title={focus ? "Leave focus (Esc)" : "Focus — nothing but the page"} aria-label={focus ? "Leave focus" : "Focus"} onClick={() => setFocus((f) => !f)}>
        {focus ? <Shrink /> : <Expand />}
      </Button>
    </>
  );

  const page = current === OUTTAKES ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <OuttakesView manuscriptId={id} chapters={chapters} />
    </div>
  ) : doc ? (
    <div className={cn("flex min-h-0 flex-1 flex-col", focus && "mx-auto w-full max-w-[72ch]")}>
      <DocumentEditor key={doc.id} doc={doc} def={documentType(doc.type)} index={index} showPanel={!focus && isChapter} minimal={focus} toolbar={tools} onDeleted={() => (doc.id === id ? navigate(SHELF_HREF) : pick(PLAN))} />
    </div>
  ) : (
    <div className="text-muted-foreground p-6 text-sm">That chapter isn't here any more.</div>
  );

  if (focus) return <div className="bg-background fixed inset-0 z-50 flex flex-col font-serif">{page}</div>;

  return (
    <div className="flex h-full min-h-0">
      <aside className="bg-sidebar text-sidebar-foreground flex w-64 shrink-0 flex-col border-r max-md:hidden">
        <Binder manuscript={manuscript} chapters={chapters} outtakes={outtakes.length} current={current} onPick={pick} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {page}
        <PhoneDock>
          <Button size="sm" variant="outline" className="md:hidden" onClick={() => setBinder(true)}>
            <BookOpenText /> Binder
          </Button>
        </PhoneDock>
      </div>
      <Sheet open={binder} onOpenChange={setBinder}>
        <SheetContent side="left" className="w-72 max-w-full p-0">
          <SheetTitle className="sr-only">Binder</SheetTitle>
          <Binder manuscript={manuscript} chapters={chapters} outtakes={outtakes.length} current={current} onPick={pick} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

