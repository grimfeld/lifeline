import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, PhoneDock, toast, Tip } from "@lifeline/ui";
import { basePath, createDocument, displayTitle, documentType, excerpt, singularOf, useAllDocuments, useDocument, useDocumentTypes, useLinkIndex, useUserDocumentTypes, type DocumentTypeDef } from "@lifeline/core";
import { DocumentEditor, TemplateSelect, TypeEditor } from "@lifeline/editor";
import { ArrowLeft, Pencil, Plus, Table2 } from "lucide-react";
import { JOURNAL_HREF } from "../domain/types";
import { TypeReports } from "../components/TypeReports";

/** The Journal Module's id: what a user-defined type names to be homed here. */
export const JOURNAL_MODULE = "journal";
export const typeHref = (type: string) => `${JOURNAL_HREF}/t/${type}`;
export const journalDocHref = (id: string) => `${JOURNAL_HREF}/d/${id}`;

/** The user-defined types homed in the Journal (ADR 0068): its Types — people, places, whatever the user made and put here. */
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
 * /app/journal/t and /app/journal/t/:type — the Journal's Types: every
 * user-defined type homed here, listed without the Journal knowing what it is,
 * and made, edited and deleted here (CONTEXT.md "Journal"). A type made here
 * is homed here; one re-homed elsewhere leaves. Its Documents in bulk stay in
 * its Base, which this page only links down to.
 */
export function TypesScreen() {
  const { type: only } = useParams();
  const homed = useHomedTypes();
  const allTypes = useDocumentTypes();
  const records = useUserDocumentTypes();
  const docs = useAllDocuments();
  const [adding, setAdding] = useState<DocumentTypeDef | null>(null);
  const [editing, setEditing] = useState<DocumentTypeDef | "new" | null>(null);
  const shown = only ? homed.filter((t) => t.id === only) : homed;
  const index = useLinkIndex();
  const editingRecord = editing && editing !== "new" ? (records.find((r) => r.typeId === editing.id) ?? null) : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-4 md:p-6">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{only && shown[0] ? shown[0].label : "Types"}</h1>
        {only ? (
          <Button asChild size="sm" variant="ghost" className="h-7 shrink-0">
            <Link to={`${JOURNAL_HREF}/t`}>
              <ArrowLeft /> All types
            </Link>
          </Button>
        ) : (
          <PhoneDock>
            <Button size="sm" className="shrink-0" onClick={() => setEditing("new")}>
              <Plus /> New type
            </Button>
          </PhoneDock>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="text-muted-foreground grid justify-items-start gap-2 text-sm">
          <p>No types here yet. A type is a kind of page of your own — People, Places — with the fields you give it.</p>
          {!only && (
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
              <Plus /> New type
            </Button>
          )}
        </div>
      ) : (
        shown.map((t) => {
          const mine = docs.filter((d) => d.type === t.id).sort((a, b) => displayTitle(a, t).localeCompare(displayTitle(b, t)));
          return (
            <section key={t.id} className="grid gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <Link to={typeHref(t.id)} className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium tracking-wide uppercase hover:underline">
                  {t.label} · {mine.length}
                  {mine.length === 0 && " here"}
                </Link>
                <Button size="sm" variant="ghost" className="h-7 max-w-40 shrink-0" onClick={() => setAdding(t)} title={`New ${singularOf(t).toLowerCase()}`}>
                  <Plus /> <span className="truncate">New {singularOf(t).toLowerCase()}</span>
                </Button>
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => setEditing(t)} title={`Edit the type ${t.label}`} aria-label={`Edit the type ${t.label}`}>
                  <Pencil />
                </Button>
                <Tip label={`${t.label} Base`}>
                  <Button asChild size="icon-sm" variant="ghost" className="shrink-0">
                    <Link to={basePath(t.id)} aria-label={`${t.label} Base`}>
                      <Table2 />
                    </Link>
                  </Button>
                </Tip>
              </div>
              {only && <TypeReports type={t} index={index} />}
              {mine.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                  {(only ? mine : mine.slice(0, 12)).map((d) => (
                    <Link key={d.id} to={journalDocHref(d.id)} className="bg-card hover:bg-accent/40 grid min-w-0 gap-0.5 rounded-lg border p-2">
                      <span className="truncate text-sm font-medium">{displayTitle(d, t)}</span>
                      <span className="text-muted-foreground line-clamp-2 text-xs">{excerpt(typeof d.body === "string" ? d.body : "", 120) || "—"}</span>
                    </Link>
                  ))}
                </div>
              )}
              {!only && mine.length > 12 && (
                <Link to={typeHref(t.id)} className="text-muted-foreground truncate text-xs hover:underline">
                  All {mine.length} {t.label.toLowerCase()} →
                </Link>
              )}
            </section>
          );
        })
      )}
      {adding && <NewInTypeDialog type={adding} open={!!adding} onOpenChange={(o) => !o && setAdding(null)} />}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{editing && editing !== "new" ? `Edit ${editing.label}` : "New type"}</DialogTitle>
            <DialogDescription>Its fields, icon and where its pages open. A type made here lives in the Journal.</DialogDescription>
          </DialogHeader>
          {editing && <TypeEditor key={editing === "new" ? "new" : editing.id} record={editingRecord} allTypes={allTypes} defaultModule={JOURNAL_MODULE} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** /app/journal/c and /app/journal/c/:type — the old "Collections" links, now the Types. */
export function OldCollectionsRedirect() {
  const { type } = useParams();
  return <Navigate to={type ? typeHref(type) : `${JOURNAL_HREF}/t`} replace />;
}

/** /app/journal/d/:id — one Document written in the Journal: a person, a place, a Template. */
export function JournalDocScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDocument(id);
  const index = useLinkIndex();
  if (!doc) return <div className="text-muted-foreground p-6 text-sm">This page isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  const def = documentType(doc.type);
  const back = def && !def.builtIn ? typeHref(def.id) : doc.type === "template" ? `${JOURNAL_HREF}/templates` : JOURNAL_HREF;
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
