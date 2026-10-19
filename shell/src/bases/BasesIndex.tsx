import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, PhoneDock, toast } from "@lifeline/ui";
import {
  appById,
  basePath,
  deleteDocumentType,
  deleteUserDocumentType,
  TEMPLATE_TYPE,
  templatesFor,
  templatesPath,
  useAllDocuments,
  useDocumentTypes,
  useUserDocumentTypes,
  type DocumentTypeDef,
  type DocumentTypeRecord,
} from "@lifeline/core";
import { LayoutTemplate, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { TypeEditor } from "@lifeline/editor";

/** `/base`: every Document type with its count — the Bases list and the type manager (ADR 0019). */
export function BasesIndex() {
  const types = useDocumentTypes();
  const userTypes = useUserDocumentTypes();
  const docs = useAllDocuments();
  const [editing, setEditing] = useState<{ record: DocumentTypeRecord | null; base?: DocumentTypeDef } | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) m.set(d.type, (m.get(d.type) ?? 0) + 1);
    return m;
  }, [docs]);
  const templateDocs = useMemo(() => docs.filter((d) => d.type === TEMPLATE_TYPE), [docs]);

  async function removeType(r: DocumentTypeRecord, builtIn: boolean) {
    if (builtIn) {
      if (!window.confirm(`Reset “${r.label}” to its built-in default?`)) return;
      await deleteDocumentType(r.id);
      return void toast.success(`“${r.label}” reset to its built-in default`);
    }
    // ADR 0072: refused while any Document of the type is left, in any Workspace.
    try {
      await deleteUserDocumentType(r);
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    toast.success(`Type “${r.label}” deleted`);
  }

  const visible = types.filter((t) => !t.internal);
  const internal = types.filter((t) => t.internal);
  const Row = ({ t }: { t: DocumentTypeDef }) => {
    const I = t.icon;
    const rec = userTypes.find((r) => r.typeId === t.id);
    const app = t.appId ? appById(t.appId) : undefined;
    return (
      <li className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
        <Link to={basePath(t.id)} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
          {I && <I className="text-muted-foreground size-4 shrink-0" />}
          <span className="font-medium">{t.label}</span>
          <span className="text-muted-foreground text-xs">{counts.get(t.id) ?? 0}</span>
        </Link>
        {app ? (
          <Badge variant="secondary" className="shrink-0" title={`Built-in type owned by the ${app.title} App`}>
            {app.title}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            user-defined
          </Badge>
        )}
        {t.overridden && <Badge variant="outline">edited</Badge>}
        {t.body !== "none" && t.titleRule !== "derived" && (
          <Button asChild size="icon" variant="ghost" className="size-7" title={`Templates · ${templatesFor(t.id, templateDocs).length}`}>
            <Link to={templatesPath(t.id)} aria-label={`${t.label} templates`}>
              <LayoutTemplate className="size-3.5" />
            </Link>
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing({ record: rec ?? null, base: t.builtIn ? t : undefined })} aria-label="Edit type">
          <Pencil className="size-3.5" />
        </Button>
        {rec && (
          <Button size="icon" variant="ghost" className="size-7" onClick={() => void removeType(rec, !!t.builtIn)} title={t.builtIn ? "Reset to default" : "Delete type"}>
            {t.builtIn ? <RotateCcw className="size-3.5" /> : <Trash2 className="size-3.5" />}
          </Button>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-6">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Bases</h1>
        <span className="text-muted-foreground text-sm">one per Document type — adding a type adds a Base</span>
        <PhoneDock>
          <Button className="ml-auto" onClick={() => setEditing({ record: null })}>
            <Plus /> New type
          </Button>
        </PhoneDock>
      </header>
      <ul className="grid gap-1">
        {visible.map((t) => (
          <Row key={t.id} t={t} />
        ))}
      </ul>
      {internal.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">Internal types · {internal.length}</summary>
          <ul className="mt-2 grid gap-1">
            {internal.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </details>
      )}
      <p className="text-muted-foreground text-xs">
        Built-in types belong to an App, which alone changes their guarded fields. User-defined types get a form, a Base, the Vault editor and the Linkable / Locatable Contracts from their fields. Templates seed the body of new Documents; placeholders <code>{"{{title}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{time}}"}</code>.
      </p>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.record || editing?.base ? `Edit ${editing.record?.label ?? editing.base?.label}` : "New Document type"}</DialogTitle>
            <DialogDescription>A type fixes a Document's fields, icon, folder and body policy. Built-ins keep their rules; yours sync like Documents.</DialogDescription>
          </DialogHeader>
          {editing && <TypeEditor record={editing.record} base={editing.base} allTypes={types} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
