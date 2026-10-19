import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, PhoneDock, Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import { displayTitle, documentType, singularOf, useDocument, useDocumentTypes, useLinkIndex, type Document, type LinkIndex } from "@lifeline/core";
import { DocumentEditor, LocalGraphPanel } from "@lifeline/editor";
import { ArrowLeft, Library, Pin, PinOff, X } from "lucide-react";
import { setPinned } from "../data";
import { candidatesOf, materialOf } from "../domain/material";
import { ESSAY, RESEARCH_HREF, type Essay } from "../types";

const TABS_KEY = (id: string) => `research.tabs.${id}`;

function readTabs(id: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(TABS_KEY(id)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeTabs(id: string, tabs: string[]) {
  try {
    localStorage.setItem(TABS_KEY(id), JSON.stringify(tabs));
  } catch {
    /* a browser refusing storage just forgets the tabs */
  }
}

/** The Essay's material, its candidates and its graph: the right side of the Research desk. */
function MaterialPane({ essay, index, onOpen }: { essay: Essay; index: LinkIndex; onOpen: (id: string) => void }) {
  const types = useDocumentTypes();
  const defs = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const material = useMemo(() => materialOf(essay, index), [essay, index]);
  const candidates = useMemo(() => candidatesOf(essay.id, material, index, (d) => d.type !== ESSAY && !defs.get(d.type)?.internal).slice(0, 12), [essay.id, material, index, defs]);
  const row = (id: string, right: React.ReactNode, sub?: string) => {
    const d = index.byId.get(id);
    if (!d) return null;
    const def = defs.get(d.type);
    return (
      <li key={id} className="group flex min-w-0 items-center gap-1">
        <button type="button" onClick={() => onOpen(id)} className="hover:bg-accent flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-sm">
          <span className="min-w-0 flex-1 truncate">{displayTitle(d, def)}</span>
          <span className="text-muted-foreground shrink-0 text-[10px]">{sub ?? (def ? singularOf(def) : d.type)}</span>
        </button>
        {right}
      </li>
    );
  };
  return (
    <div className="grid content-start gap-5">
      <section className="grid gap-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Material · {material.length}</h2>
        {material.length === 0 ? (
          <p className="text-muted-foreground text-xs">Link Notes, Quotes, Sources and Thoughts from the text, or pin them from the candidates.</p>
        ) : (
          <ul className="grid gap-0.5">
            {material.map((m) =>
              row(
                m.id,
                m.via === "pinned" ? (
                  <Button size="icon" variant="ghost" className="size-6 shrink-0 opacity-60 group-hover:opacity-100" title="Unpin" aria-label="Unpin" onClick={() => void setPinned(essay.id, m.id, false)}>
                    <PinOff className="size-3.5" />
                  </Button>
                ) : (
                  <span className="text-muted-foreground w-6 shrink-0 text-center text-[10px]" title="Linked from the text">
                    [[ ]]
                  </span>
                ),
              ),
            )}
          </ul>
        )}
      </section>
      <section className="grid gap-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Candidates</h2>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nothing near the material yet.</p>
        ) : (
          <ul className="grid gap-0.5">
            {candidates.map((c) =>
              row(
                c.id,
                <Button size="icon" variant="ghost" className="size-6 shrink-0 opacity-60 group-hover:opacity-100" title="Pin as material" aria-label="Pin as material" onClick={() => void setPinned(essay.id, c.id, true)}>
                  <Pin className="size-3.5" />
                </Button>,
                c.touches > 1 ? `near ${c.touches}` : undefined,
              ),
            )}
          </ul>
        )}
      </section>
      <section className="grid gap-1">
        <LocalGraphPanel docId={essay.id} index={index} onOpen={(ref) => ref.kind === "doc" && onOpen(ref.id)} />
      </section>
    </div>
  );
}

/** One open tab's editor: the Essay itself, or a piece of material written right here. */
function TabEditor({ id, index, onDeleted }: { id: string; index: LinkIndex; onDeleted: () => void }) {
  const doc = useDocument<Document>(id);
  if (!doc) return <div className="text-muted-foreground p-6 text-sm">This page isn't here any more.</div>;
  return <DocumentEditor key={doc.id} doc={doc} def={documentType(doc.type)} index={index} showPanel={false} onDeleted={onDeleted} />;
}

/**
 * /app/research/e/:id — writing an Essay from its material (ADR 0068): the
 * Essay and the material I opened beside it as tabs, the material, the
 * candidates one link away, and the graph on the right.
 */
export function EssayScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const essay = useDocument<Essay>(id);
  const index = useLinkIndex();
  const [tabs, setTabs] = useState<string[]>(() => readTabs(id));
  const [active, setActive] = useState<string>(id);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    setTabs(readTabs(id));
    setActive(id);
  }, [id]);
  useEffect(() => writeTabs(id, tabs), [id, tabs]);

  if (!essay) return <div className="text-muted-foreground p-6 text-sm">This essay isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  const open = (docId: string) => {
    if (docId !== id && !tabs.includes(docId)) setTabs((t) => [...t, docId]);
    setActive(docId);
    setSheet(false);
  };
  const close = (docId: string) => {
    setTabs((t) => t.filter((x) => x !== docId));
    if (active === docId) setActive(id);
  };
  const title = (docId: string) => {
    const d = index.byId.get(docId);
    return d ? displayTitle(d, documentType(d.type)) : "…";
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1 border-b px-2 py-1">
          <Button asChild size="icon" variant="ghost" className="size-7 shrink-0" title="Research">
            <Link to={RESEARCH_HREF} aria-label="Back to Research">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" data-scroll-x role="tablist" aria-label="Open pages">
            {[id, ...tabs].map((t) => (
              <div key={t} className={cn("flex max-w-56 shrink-0 items-center rounded-md border text-xs", active === t ? "bg-accent text-accent-foreground border-transparent" : "text-muted-foreground")}>
                <button type="button" role="tab" aria-selected={active === t} onClick={() => setActive(t)} className="min-w-0 truncate px-2 py-1 font-medium">
                  {t === id ? essay.title : title(t)}
                </button>
                {t !== id && (
                  <button type="button" onClick={() => close(t)} className="hover:text-foreground pr-1.5" aria-label={`Close ${title(t)}`}>
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <TabEditor key={active} id={active} index={index} onDeleted={() => (active === id ? navigate(RESEARCH_HREF) : close(active))} />
        </div>
        <PhoneDock>
          <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setSheet(true)}>
            <Library /> Material
          </Button>
        </PhoneDock>
      </div>
      <aside className="w-80 shrink-0 overflow-y-auto border-l p-3 max-lg:hidden" aria-label="Material">
        <MaterialPane essay={essay} index={index} onOpen={open} />
      </aside>
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="right" className="w-[22rem] max-w-full overflow-y-auto p-3">
          <SheetTitle className="mb-2">Material</SheetTitle>
          <MaterialPane essay={essay} index={index} onOpen={open} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

