import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge, Button, Card, CardContent, GraphView, Input, PhoneDock, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { buildGraph, displayTitle, docHref, documentType, excerpt, formatHuman, singularOf, useDocumentTypes, useLinkIndex, vaultDocPath, type Document } from "@lifeline/core";
import { BookOpen, ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { canonical, parseRef } from "../domain/refs";
import { CHARACTER, CONCEPT, REFERENCE_TYPES, type BibleBook } from "../domain/types";
import { ensureRef, useBooks, useChapters, useCharacters, useConcepts, useStudy, useVerses } from "../data/repo";
import { ReferenceDialog } from "../components/Dialogs";

const TABS = ["study", "scripture", "characters", "concepts", "talks", "graph"] as const;
type Tab = (typeof TABS)[number];

/** One row of the desk. Below `md` the type and the date sit under the title — a phone has no width for a third column (ADR 0021). */
function DocRow({ d, mentions }: { d: Document; mentions?: number }) {
  const navigate = useNavigate();
  const def = documentType(d.type);
  const kind = def ? singularOf(def) : "";
  const when = formatHuman(d.updatedAt.slice(0, 10));
  return (
    <button className="hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-2 text-left md:py-1.5" onClick={() => navigate(docHref(d, def))}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{displayTitle(d, def)}</span>
          {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase max-md:hidden">{kind}</span>}
        </div>
        <div className="text-muted-foreground line-clamp-1 text-xs">{excerpt(typeof d.body === "string" ? d.body : "", 120) || d.folder}</div>
        <div className="text-muted-foreground flex items-baseline gap-1.5 text-[10px] md:hidden">
          {def && <span className="uppercase">{kind}</span>}
          {def && <span aria-hidden>·</span>}
          <span>{when}</span>
        </div>
      </div>
      {mentions !== undefined && <Badge variant="outline" className="tabular-nums">{mentions}</Badge>}
      <span className="text-muted-foreground shrink-0 text-[10px] max-md:hidden">{when}</span>
    </button>
  );
}

/** The Scripture tree: Books in canon order → Chapters → Verses, each with how much the study says about it. */
function ScriptureTree() {
  const navigate = useNavigate();
  const index = useLinkIndex();
  const books = useBooks();
  const chapters = useChapters();
  const verses = useVerses();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const mentions = (id: string) => index.backlinksTo(id).length;
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (books.length === 0) return <p className="text-muted-foreground p-4 text-sm">Nothing yet. Write `[[John 3:16]]` in any note and the verse, its chapter and its book appear here.</p>;
  return (
    <ul className="grid gap-0.5">
      {books.map((b: BibleBook) => {
        const chs = chapters.filter((c) => c.bookId === b.id);
        const isOpen = open.has(b.id);
        return (
          <li key={b.id}>
            <div className="flex min-w-0 items-center gap-1">
              <button className="text-muted-foreground shrink-0 p-1" onClick={() => toggle(b.id)} aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
              <button className="hover:underline min-w-0 truncate text-sm font-medium" onClick={() => navigate(vaultDocPath(b.id))}>
                {b.title}
              </button>
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                {chs.length} ch · {mentions(b.id)} mentions
              </span>
            </div>
            {isOpen && (
              <ul className="ml-4 grid gap-0.5 md:ml-6">
                {chs.map((c) => {
                  const vs = verses.filter((v) => v.chapterId === c.id);
                  const cOpen = open.has(c.id);
                  return (
                    <li key={c.id}>
                      <div className="flex min-w-0 items-center gap-1">
                        <button className="text-muted-foreground shrink-0 p-1" onClick={() => toggle(c.id)} aria-label={cOpen ? "Collapse" : "Expand"}>
                          {cOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                        <button className="hover:underline min-w-0 truncate text-sm" onClick={() => navigate(vaultDocPath(c.id))}>
                          {c.title}
                        </button>
                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                          {vs.length} v · {mentions(c.id)}
                        </span>
                      </div>
                      {cOpen && (
                        <ul className="ml-4 flex flex-wrap gap-1 py-1 md:ml-6">
                          {vs.map((v) => (
                            <button key={v.id} className="hover:bg-accent rounded-md border px-1.5 py-0.5 text-xs tabular-nums" title={`${mentions(v.id)} mentions`} onClick={() => navigate(vaultDocPath(v.id))}>
                              {v.verse} <span className="text-muted-foreground">·{mentions(v.id)}</span>
                            </button>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BibleGraph() {
  const navigate = useNavigate();
  const index = useLinkIndex();
  const types = useDocumentTypes();
  const model = useMemo(() => buildGraph(index, types, { focusTypes: new Set(REFERENCE_TYPES), ghosts: true }), [index, types]);
  if (model.nodes.length === 0) return <p className="text-muted-foreground p-4 text-sm">The graph fills as notes link verses, characters and concepts.</p>;
  return (
    <div className="h-[60dvh] min-h-72 overflow-hidden rounded-lg border md:h-[70dvh] md:min-h-96">
      <GraphView nodes={model.nodes} edges={model.edges} storageKey="bible" onSelect={(n) => n.kind === "doc" && n.id.startsWith("d:") && navigate(vaultDocPath(n.id.slice(2)))} />
    </div>
  );
}

/**
 * The study desk (ADR 0032), in the Vault: the study, the scripture touched,
 * characters, concepts, talks, the scoped graph. Below `md` the lookup and the
 * six tabs go to the phone dock, the tabs a strip that scrolls, the chosen one
 * brought into view — see ADR 0021.
 */
export function BibleDeskScreen() {
  const navigate = useNavigate();
  const index = useLinkIndex();
  const study = useStudy();
  const characters = useCharacters();
  const concepts = useConcepts();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "study";
  const [lookup, setLookup] = useState("");
  const [newRef, setNewRef] = useState<typeof CHARACTER | typeof CONCEPT | null>(null);
  const parsed = parseRef(lookup);
  const talks = useMemo(() => study.filter((d) => d.type === "writing"), [study]);
  const tabsRef = useRef<HTMLDivElement>(null);

  // The strip scrolls below md, so the chosen tab has to be brought into view — otherwise the desk shows a tab nobody can see is active.
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  async function go() {
    if (!parsed) return;
    const doc = await ensureRef(parsed);
    setLookup("");
    navigate(vaultDocPath(doc.id));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* grid-cols-1 (minmax(0,1fr)): without it the tab strip's min-content sizes the single track and the whole desk runs off a phone. */}
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 p-4 md:p-6">
        <div className="grid gap-2 md:flex md:flex-wrap md:items-center md:gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl">
            <BookOpen className="size-5 shrink-0 md:size-6" /> Bible study
          </h1>
          <PhoneDock>
            <div className="flex items-center gap-1 max-md:contents md:ml-auto">
              <Input className="h-9 min-w-0 flex-1 md:h-8 md:w-44 md:flex-none" placeholder="Jn 3:16" value={lookup} onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void go()} aria-label="Look up a reference" />
              <Button size="sm" variant="outline" className="h-9 shrink-0 md:h-8" disabled={!parsed} onClick={() => void go()} title={parsed ? `Open ${canonical(parsed)}` : "Type a reference"}>
                <Search /> {parsed ? canonical(parsed) : "Open"}
              </Button>
            </div>
          </PhoneDock>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams(v === "study" ? {} : { tab: v })}>
          {/* A narrow desk may not fit six tabs; the strip scrolls (justify-start, or the first tabs would be unreachable) and the chosen one is scrolled into view. On a phone it is a select. */}
          <PhoneDock order={1}>
            <TabsList ref={tabsRef} className="md:max-w-full md:justify-start md:overflow-x-auto md:overflow-y-hidden md:scroll-px-3">
              <TabsTrigger value="study">Study ({study.length})</TabsTrigger>
              <TabsTrigger value="scripture">Scripture</TabsTrigger>
              <TabsTrigger value="characters">Characters ({characters.length})</TabsTrigger>
              <TabsTrigger value="concepts">Concepts ({concepts.length})</TabsTrigger>
              <TabsTrigger value="talks">Talks ({talks.length})</TabsTrigger>
              <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>
          </PhoneDock>

          <TabsContent value="study" className="grid gap-1 pt-4">
            {study.length === 0 && (
              <Card>
                <CardContent className="text-muted-foreground p-6 text-center text-sm">The study is every note, clipping or writing that links a verse, a character or a concept. Write one and it appears here.</CardContent>
              </Card>
            )}
            {study.map((d) => (
              <DocRow key={d.id} d={d} />
            ))}
          </TabsContent>
          <TabsContent value="scripture" className="pt-4">
            <ScriptureTree />
          </TabsContent>
          <TabsContent value="characters" className="grid gap-1 pt-4">
            <Button size="sm" className="w-fit" onClick={() => setNewRef(CHARACTER)}>
              <Plus /> New character
            </Button>
            {characters.map((c) => (
              <DocRow key={c.id} d={c} mentions={index.backlinksTo(c.id).length} />
            ))}
          </TabsContent>
          <TabsContent value="concepts" className="grid gap-1 pt-4">
            <Button size="sm" className="w-fit" onClick={() => setNewRef(CONCEPT)}>
              <Plus /> New concept
            </Button>
            {concepts.map((c) => (
              <DocRow key={c.id} d={c} mentions={index.backlinksTo(c.id).length} />
            ))}
          </TabsContent>
          <TabsContent value="talks" className="grid gap-1 pt-4">
            {talks.length === 0 && <p className="text-muted-foreground text-sm">A talk is a Writing that links what it draws on. Write one on the Writer's pad.</p>}
            {talks.map((d) => (
              <DocRow key={d.id} d={d} />
            ))}
          </TabsContent>
          <TabsContent value="graph" className="pt-4">
            <BibleGraph />
          </TabsContent>
        </Tabs>
      </div>
      <ReferenceDialog open={newRef !== null} onOpenChange={(o) => !o && setNewRef(null)} type={newRef ?? CHARACTER} />
    </div>
  );
}
