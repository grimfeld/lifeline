import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { basePath, createDocument, displayTitle, documentType, excerpt, singularOf, useAllDocuments, useDocument, useDocumentTypes, useLinkIndex, type DocumentTypeDef } from "@lifeline/core";
import { DocumentEditor, TemplateSelect } from "@lifeline/editor";
import { ArrowLeft, Plus, Settings2 } from "lucide-react";
import { JOURNAL_HREF } from "../domain/types";

/** The Journal Module's id: what a user-defined type names to be homed here. */
export const JOURNAL_MODULE = "journal";
export const collectionHref = (type: string) => `${JOURNAL_HREF}/c/${type}`;
export const journalDocHref = (id: string) => `${JOURNAL_HREF}/d/${id}`;

/** The user-defined types homed in the Journal (ADR 0068): people, places — whatever the user made and put here. */
export function useHomedTypes(): DocumentTypeDef[] {
  const types = useDocumentTypes();
  return useMemo(() => types.filter((t) => !t.builtIn && t.homeModule === JOURNAL_MODULE), [types]);
}

function NewInTypeDialog({ type, open, onOpenChange }: { type: DocumentTypeDef; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  async function save() {
    try {
      const d = await createDocument({ type: type.id, title, templateId: templateId || undefined });
      setTitle("");
      onOpenChange(false);
      navigate(journalDocHref(d.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New {singularOf(type).toLowerCase()}</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && void save()} placeholder="Name" aria-label="Name" />
        <TemplateSelect type={type.id} value={templateId} onChange={setTemplateId} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void save()} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * /app/journal/c and /app/journal/c/:type — the Journal's collections: every
 * user-defined type homed here, listed without the Journal knowing what it is.
 * Which types are homed is said on the type itself (Bases → the type).
 */
export function CollectionsScreen() {
  const { type: only } = useParams();
  const homed = useHomedTypes();
  const docs = useAllDocuments();
  const [adding, setAdding] = useState<DocumentTypeDef | null>(null);
  const shown = only ? homed.filter((t) => t.id === only) : homed;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{only && shown[0] ? shown[0].label : "Collections"}</h1>
        {only && (
          <Button asChild size="sm" variant="ghost" className="ml-auto h-7">
            <Link to={`${JOURNAL_HREF}/c`}>
              <ArrowLeft /> All collections
            </Link>
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="text-muted-foreground grid gap-2 text-sm">
          <p>No collections here yet. A collection is a type of your own — People, Places — homed in the Journal.</p>
          <p>
            Make one in{" "}
            <Link to="/base" className="underline underline-offset-2">
              Bases
            </Link>{" "}
            and set its Module to Journal.
          </p>
        </div>
      ) : (
        shown.map((t) => {
          const mine = docs.filter((d) => d.type === t.id).sort((a, b) => displayTitle(a, t).localeCompare(displayTitle(b, t)));
          return (
            <section key={t.id} className="grid gap-2">
              <div className="flex items-center gap-2">
                <Link to={collectionHref(t.id)} className="text-muted-foreground text-xs font-medium tracking-wide uppercase hover:underline">
                  {t.label} · {mine.length}
                </Link>
                <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setAdding(t)}>
                  <Plus /> New {singularOf(t).toLowerCase()}
                </Button>
                <Button asChild size="icon" variant="ghost" className="size-7" title={`${t.label}: fields and settings`}>
                  <Link to={basePath(t.id)} aria-label={`${t.label} Base`}>
                    <Settings2 />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                {(only ? mine : mine.slice(0, 12)).map((d) => (
                  <Link key={d.id} to={journalDocHref(d.id)} className="bg-card hover:bg-accent/40 grid min-w-0 gap-0.5 rounded-lg border p-2">
                    <span className="truncate text-sm font-medium">{displayTitle(d, t)}</span>
                    <span className="text-muted-foreground line-clamp-2 text-xs">{excerpt(typeof d.body === "string" ? d.body : "", 120) || "—"}</span>
                  </Link>
                ))}
              </div>
              {!only && mine.length > 12 && (
                <Link to={collectionHref(t.id)} className="text-muted-foreground text-xs hover:underline">
                  All {mine.length} {t.label.toLowerCase()} →
                </Link>
              )}
            </section>
          );
        })
      )}
      {adding && <NewInTypeDialog type={adding} open={!!adding} onOpenChange={(o) => !o && setAdding(null)} />}
    </div>
  );
}

/** /app/journal/d/:id — one Document written in the Journal: a person, a place, a Template. */
export function JournalDocScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDocument(id);
  const index = useLinkIndex();
  if (!doc) return <div className="text-muted-foreground p-6 text-sm">This page isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  const def = documentType(doc.type);
  const back = def && !def.builtIn ? collectionHref(def.id) : doc.type === "template" ? `${JOURNAL_HREF}/templates` : JOURNAL_HREF;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Button asChild size="sm" variant="ghost" className="h-7">
          <Link to={back}>
            <ArrowLeft /> {def && !def.builtIn ? def.label : doc.type === "template" ? "Templates" : "Journal"}
          </Link>
        </Button>
      </div>
      <DocumentEditor key={doc.id} doc={doc} def={def} index={index} onDeleted={() => navigate(back)} />
    </div>
  );
}
