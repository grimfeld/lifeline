import { useState } from "react";
import { Checkbox, TagChips, cn } from "@lifeline/ui";
import { displayTitle, documentType, formatHuman, isExternalUrl, patchDocument, readGeo, useAllDocuments, type Document, type FieldDef } from "@lifeline/core";
import { DocLink, FieldControl } from "@lifeline/editor";

/** Read-only rendering of one field value. */
export function CellValue({ doc, field }: { doc: Document; field: FieldDef }) {
  const v = doc[field.key];
  if (field.key === "title") {
    return (
      <DocLink doc={doc} className="font-medium hover:underline">
        {displayTitle(doc, documentType(doc.type))}
      </DocLink>
    );
  }
  if (field.key === "tags" || field.kind === "multiselect") return Array.isArray(v) && v.length > 0 ? <TagChips tags={v.map(String)} size="xs" /> : <span className="text-muted-foreground">—</span>;
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  switch (field.kind) {
    case "boolean":
      return <Checkbox checked={!!v} disabled className="pointer-events-none" />;
    case "date":
      return <span title={String(v)}>{formatHuman(String(v))}</span>;
    case "datetime": {
      const d = new Date(String(v));
      return <span className="tabular-nums">{Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>;
    }
    case "geo": {
      const g = readGeo(v);
      return g ? <span className="tabular-nums text-xs">{g.lat.toFixed(4)}, {g.lon.toFixed(4)}</span> : <span className="text-muted-foreground">—</span>;
    }
    case "list":
      return <span>{Array.isArray(v) ? v.join(", ") : String(v)}</span>;
    case "link":
    case "links":
      return <LinkValue ids={(Array.isArray(v) ? v.map(String) : [String(v)]).filter(Boolean)} />;
    case "url":
      // Only an http(s) address becomes a link: a stored `javascript:` one stays text.
      if (!isExternalUrl(String(v))) return <span className="truncate">{String(v)}</span>;
      return (
        <a href={String(v)} target="_blank" rel="noreferrer" className="text-primary truncate hover:underline">
          {String(v).replace(/^https?:\/\//, "")}
        </a>
      );
    case "json":
      return <code className="text-muted-foreground text-2xs">{JSON.stringify(v)}</code>;
    case "select": {
      const o = field.options?.find((o) => o.value === String(v));
      return <span>{o?.label ?? String(v)}</span>;
    }
    case "number":
      return <span className="tabular-nums">{typeof v === "number" ? v.toLocaleString() : String(v)}</span>;
    default:
      return <span className="truncate">{String(v)}</span>;
  }
}

function LinkValue({ ids }: { ids: string[] }) {
  const docs = useAllDocuments();
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const d = docs.find((x) => x.id === id);
        return d ? (
          <DocLink key={id} doc={d} className="hover:underline">
            [[{displayTitle(d, documentType(d.type))}]]
          </DocLink>
        ) : (
          <span key={id} className="text-muted-foreground">
            {id}
          </span>
        );
      })}
    </span>
  );
}

/**
 * An editable cell: read-only rendering until clicked, then the generic
 * control; guarded fields and pseudo-fields stay read-only (ADR 0019).
 */
export function EditableCell({ doc, field, editable }: { doc: Document; field: FieldDef; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const canEdit = editable && !field.guarded && field.key !== "title" && field.key !== "createdAt" && field.key !== "updatedAt" && field.kind !== "json";
  if (!editing || !canEdit) {
    return (
      <div
        className={cn("min-h-6 truncate", canEdit && "cursor-text rounded px-1 -mx-1 hover:bg-accent/60", field.guarded && "opacity-80")}
        title={field.guarded ? "Guarded — change it from its App" : undefined}
        onClick={() => canEdit && setEditing(true)}
      >
        <CellValue doc={doc} field={field} />
      </div>
    );
  }
  return (
    <div className="min-w-40" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setEditing(false)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
      <FieldControl
        def={field}
        value={doc[field.key]}
        all={doc}
        onChange={(v) => void patchDocument(doc.id, { [field.key]: v })}
        onSet={(k, v) => void patchDocument(doc.id, { [k]: v })}
      />
    </div>
  );
}
