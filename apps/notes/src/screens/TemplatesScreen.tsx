import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Badge, Button, Input, toast } from "@lifeline/ui";
import { createDocument, templatesFor, defaultTemplateFor, useAllDocuments, useDocumentTypes, isVaultType, type DocumentTypeDef } from "@lifeline/core";
import { Plus } from "lucide-react";
import { TEMPLATE } from "../domain/types";
import { journalDocHref } from "./CollectionsScreen";

/**
 * /app/journal/templates — every Document type's own Templates (CONTEXT.md
 * "Template"): the starting bodies a new Day, Week, Note or Chapter can be
 * made from. The one titled by the type id is its default; a built-in's code
 * template applies when it has none. `#templates-<type>` scrolls to a type's
 * own section — where the type editor's "Templates" link lands.
 */
export function TemplatesScreen() {
  const navigate = useNavigate();
  const types = useDocumentTypes();
  const docs = useAllDocuments();
  const [names, setNames] = useState<Record<string, string>>({});
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [hash, types]);
  const bodied = useMemo(() => types.filter((t) => !t.internal && t.id !== TEMPLATE && t.titleRule !== "derived" && (isVaultType(t) || t.body !== "none")), [types]);

  async function add(t: DocumentTypeDef) {
    const title = (names[t.id] ?? "").trim() || (templatesFor(t.id, docs).length === 0 ? t.id : "");
    if (!title) return void toast.error("Name the template");
    try {
      const d = await createDocument({ type: TEMPLATE, title, body: t.builtIn ? (t.template ?? "") : "", fields: { forType: t.id } });
      setNames((n) => ({ ...n, [t.id]: "" }));
      navigate(journalDocHref(d.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 p-4 md:p-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground text-sm">Each kind of page has its own. A new one starts from the default; pick another when you make it.</p>
      </div>
      {bodied.map((t) => {
        const mine = templatesFor(t.id, docs);
        const def = defaultTemplateFor(t.id, docs);
        return (
          <section key={t.id} id={`templates-${t.id}`} className="grid scroll-mt-4 gap-2 rounded-lg border p-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{t.label}</h2>
              {mine.length === 0 && <span className="text-muted-foreground shrink-0 text-xs">{t.builtIn && t.template ? "built-in default" : "starts empty"}</span>}
            </div>
            {mine.length > 0 && (
              <ul className="grid gap-1">
                {mine.map((d) => (
                  <li key={d.id} className="flex min-w-0 items-center gap-2">
                    <Link to={journalDocHref(d.id)} className="min-w-0 flex-1 truncate text-sm hover:underline">
                      {d.title}
                    </Link>
                    {def?.id === d.id && (
                      <Badge variant="secondary" className="shrink-0">
                        default
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Input
                className="h-8 min-w-0 flex-1"
                placeholder={mine.length === 0 ? `Default (named “${t.id}”), or a name` : "Another template's name"}
                value={names[t.id] ?? ""}
                onChange={(e) => setNames((n) => ({ ...n, [t.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && void add(t)}
                aria-label={`New template for ${t.label}`}
              />
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => void add(t)}>
                <Plus /> Template
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
