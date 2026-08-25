import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, CardContent, Input } from "@lifeline/ui";
import { displayTitle, docHref, documentType, excerpt, formatHuman, singularOf, vaultDocPath } from "@lifeline/core";
import { BookOpen, NotebookPen, Search, SquareArrowOutUpRight } from "lucide-react";
import { canonical, parseRef } from "../domain/refs";
import { DESK_HREF } from "../domain/types";
import { ensureRef, useCharacters, useConcepts, useStudy } from "../data/repo";
import { NoteOnVerseDialog } from "../components/Dialogs";

/** The phone's face of the Bible App (ADR 0021): look up, note on a verse, what was studied lately. */
export function BibleScreen() {
  const navigate = useNavigate();
  const study = useStudy().slice(0, 12);
  const characters = useCharacters();
  const concepts = useConcepts();
  const [lookup, setLookup] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const parsed = parseRef(lookup);

  async function go() {
    if (!parsed) return;
    const doc = await ensureRef(parsed);
    setLookup("");
    navigate(vaultDocPath(doc.id));
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <BookOpen className="size-5" /> Bible study
        </h1>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => navigate(DESK_HREF)}>
          Desk <SquareArrowOutUpRight />
        </Button>
      </div>
      <div className="flex gap-1">
        <Input className="h-10 flex-1" placeholder="Jn 3:16–18" value={lookup} onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void go()} aria-label="Look up a reference" />
        <Button className="h-10" disabled={!parsed} onClick={() => void go()}>
          <Search /> {parsed ? canonical(parsed) : "Open"}
        </Button>
      </div>
      <Button size="lg" className="h-12" onClick={() => setNoteOpen(true)}>
        <NotebookPen /> Note on a verse
      </Button>

      <section className="grid gap-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Lately</h2>
        {study.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground p-4 text-center text-sm">Nothing studied yet.</CardContent>
          </Card>
        )}
        {study.map((d) => {
          const def = documentType(d.type);
          return (
            <button key={d.id} className="hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-2 text-left" onClick={() => navigate(docHref(d, def))}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{displayTitle(d, def)}</span>
                  {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
                </div>
                <div className="text-muted-foreground line-clamp-1 text-xs">{excerpt(typeof d.body === "string" ? d.body : "", 100)}</div>
              </div>
              <span className="text-muted-foreground shrink-0 text-[10px]">{formatHuman(d.updatedAt.slice(0, 10))}</span>
            </button>
          );
        })}
      </section>

      {(characters.length > 0 || concepts.length > 0) && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Characters & concepts</h2>
          <div className="flex flex-wrap gap-1">
            {[...characters, ...concepts].map((c) => (
              <button key={c.id} className="hover:bg-accent rounded-md border px-2 py-1 text-xs" onClick={() => navigate(vaultDocPath(c.id))}>
                {c.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <NoteOnVerseDialog open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}
