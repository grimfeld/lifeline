import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { MarkdownView } from "@lifeline/editor";
import {
  applyView,
  basePath,
  defaultColumns,
  displayTitle,
  docHref,
  fieldsOfDocument,
  useAllDocuments,
  useAllViews,
  useDocument,
  useDocumentType,
  useDocumentTypes,
  useDocuments,
  useLinkIndex,
  useTagFilter,
  matchesTagFilter,
  type CardOption,
  type CardProps,
  type ViewLayout,
  type ViewRecord,
  singularOf,
} from "@lifeline/core";
import { ArrowUpRight } from "lucide-react";
import { LayoutView } from "../bases/LayoutView";

/**
 * Core's generic Cards (CONTEXT.md "Card"): the View card (a Base View on a
 * Screen), the Document card (one chosen Document) and the Count tile.
 * They work on any Document type, user-defined included.
 */

/** `type` → the All View of a Base; `<viewId>` → a saved View. */
export function useViewOptions(): CardOption[] {
  const types = useDocumentTypes();
  const views = useAllViews();
  return useMemo(() => {
    const out: CardOption[] = [];
    for (const t of types.filter((t) => !t.internal)) {
      out.push({ value: t.id, label: `${t.label} · All` });
      for (const v of views.filter((v) => v.type === t.id)) out.push({ value: v.id, label: `${t.label} · ${v.name}` });
    }
    return out;
  }, [types, views]);
}

function useResolvedView(value: string): { type: string; view: ViewRecord | undefined } | null {
  const types = useDocumentTypes();
  const views = useAllViews();
  if (!value) return null;
  if (types.some((t) => t.id === value)) return { type: value, view: undefined };
  const v = views.find((v) => v.id === value);
  return v ? { type: v.type, view: v } : null;
}

export function ViewCard({ settings, configure }: CardProps) {
  const sel = useResolvedView(String(settings.view ?? ""));
  const type = sel?.type ?? "";
  const def = useDocumentType(type || undefined);
  const docs = useDocuments(type || undefined);
  const filter = useTagFilter();
  const rows = useMemo(() => applyView(docs, sel?.view ?? {}, def).filter((d) => matchesTagFilter(d.tags, filter)), [docs, sel?.view, def, filter]);
  if (!sel || !def) {
    return (
      <button type="button" className="text-muted-foreground flex h-full w-full items-center justify-center text-xs underline" onClick={configure}>
        Choose a View…
      </button>
    );
  }
  const layout = (String(settings.layout ?? "") || sel.view?.layout || "list") as ViewLayout;
  const columns = sel.view?.columns ?? defaultColumns(def);
  return (
    <div className="flex h-full flex-col">
      <div className={["map", "board", "calendar"].includes(layout) ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto"}>
        <LayoutView docs={rows} def={def} columns={columns} layout={layout} picks={sel.view ?? {}} compact editable={layout === "table" || layout === "board"} />
      </div>
      <div className="text-muted-foreground flex items-center justify-between border-t px-2 py-0.5 text-2xs">
        <span>{rows.length}</span>
        <Link to={sel.view ? `${basePath(type)}?view=${sel.view.id}` : basePath(type)} className="flex items-center gap-0.5 hover:underline">
          Open Base <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

export function useDocumentOptions(): CardOption[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    return docs
      .filter((d) => !defs.get(d.type)?.internal)
      .map((d) => { const def = defs.get(d.type); return { value: d.id, label: `${displayTitle(d, def)} · ${def ? singularOf(def) : d.type}` }; })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, types]);
}

export function DocumentCard({ settings, configure }: CardProps) {
  const navigate = useNavigate();
  const doc = useDocument(String(settings.doc ?? "") || undefined);
  const def = useDocumentType(doc?.type);
  const index = useLinkIndex();
  if (!doc) {
    return (
      <button type="button" className="text-muted-foreground flex h-full w-full items-center justify-center text-xs underline" onClick={configure}>
        Choose a Document…
      </button>
    );
  }
  const fields = fieldsOfDocument(doc, def).filter((f) => !f.hidden && doc[f.key] !== undefined && doc[f.key] !== null && doc[f.key] !== "");
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <button type="button" className="flex items-center gap-1 px-1 text-left text-sm font-medium hover:underline" onClick={() => navigate(docHref(doc, def))}>
        {displayTitle(doc, def)} <ArrowUpRight className="text-muted-foreground size-3" />
      </button>
      {fields.length > 0 && (
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 px-1 text-xs">
          {fields.slice(0, 6).map((f) => (
            <div key={f.key} className="contents">
              <dt>{f.label}</dt>
              <dd className="truncate">{Array.isArray(doc[f.key]) ? (doc[f.key] as unknown[]).join(", ") : String(doc[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {typeof doc.body === "string" && doc.body && (
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <MarkdownView body={doc.body} index={index} compact docDate={doc.type === "daily" ? doc.title : null} origin={doc.id} />
        </div>
      )}
    </div>
  );
}

export function CountTile({ settings, configure }: CardProps) {
  const sel = useResolvedView(String(settings.view ?? ""));
  const type = sel?.type ?? "";
  const def = useDocumentType(type || undefined);
  const docs = useDocuments(type || undefined);
  const filter = useTagFilter();
  const n = useMemo(() => applyView(docs, sel?.view ?? {}, def).filter((d) => matchesTagFilter(d.tags, filter)).length, [docs, sel?.view, def, filter]);
  if (!sel || !def) {
    return (
      <button type="button" className="text-muted-foreground flex h-full w-full items-center justify-center text-xs underline" onClick={configure}>
        Choose a View…
      </button>
    );
  }
  return (
    <Link to={sel.view ? `${basePath(type)}?view=${sel.view.id}` : basePath(type)} className="flex h-full flex-col items-center justify-center gap-1">
      <span className="text-3xl font-semibold tabular-nums">{n}</span>
      <span className="text-muted-foreground text-xs">{sel.view ? `${def.label} · ${sel.view.name}` : def.label}</span>
    </Link>
  );
}
