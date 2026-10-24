import { useEffect, useRef, useState } from "react";
import { Checkbox, TagChips, cn } from "@lifeline/ui";
import { displayTitle, documentType, formatHuman, isExternalUrl, patchDocument, readGeo, useLinkIndex, type Document, type FieldDef } from "@lifeline/core";
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
  // The shared index's map, built once per change: a lookup per link, not a scan of every Document.
  const { byId } = useLinkIndex();
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const d = byId.get(id);
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

/** Kinds whose read-only value holds links of its own: a button cannot wrap them. */
const LINKED_KINDS = new Set(["link", "links", "url"]);

/**
 * An editable cell: read-only rendering until clicked (or Enter/Space on it),
 * then the generic control, focused; Escape puts the focus back on the cell.
 * Guarded fields and pseudo-fields stay read-only (ADR 0019).
 */
export function EditableCell({ doc, field, editable }: { doc: Document; field: FieldDef; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const cell = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  // What the control shows while it is open: each keystroke is written, but the stored row comes back a moment later.
  const [draft, setDraft] = useState<{ value: unknown } | null>(null);
  // Writes one after another, so a slow early one never lands over a later one.
  const writes = useRef(Promise.resolve());
  const write = (patch: Record<string, unknown>) => {
    writes.current = writes.current.then(() => patchDocument(doc.id, patch)).catch(() => {});
  };
  const canEdit = editable && !field.guarded && field.key !== "title" && field.key !== "createdAt" && field.key !== "updatedAt" && field.kind !== "json";
  useEffect(() => {
    if (editing) editor.current?.querySelector<HTMLElement>("input, textarea, button, [role=combobox], [tabindex]:not([tabindex='-1'])")?.focus();
    else setDraft(null);
    if (!editing && refocus.current) {
      refocus.current = false;
      cell.current?.focus();
    }
  }, [editing]);
  if (!editing || !canEdit) {
    const className = cn("min-h-6 truncate", canEdit && "cursor-text rounded px-1 -mx-1 hover:bg-accent/60", field.guarded && "opacity-80");
    const value = <CellValue doc={doc} field={field} />;
    if (!canEdit) {
      return (
        <div className={className} title={field.guarded ? "Guarded — change it from its App" : undefined}>
          {value}
        </div>
      );
    }
    // A yes/no needs no editor: the box ticks where it stands, Space included.
    if (field.kind === "boolean") {
      return <Checkbox checked={!!doc[field.key]} aria-label={field.label} onCheckedChange={(c) => void patchDocument(doc.id, { [field.key]: c === true })} />;
    }
    // A value with links of its own keeps them, and gets an edit button beside them; any other value is the button.
    if (LINKED_KINDS.has(field.kind)) {
      return (
        <div className={cn(className, "group flex items-center gap-1")} onClick={(e) => !(e.target as HTMLElement).closest("a") && setEditing(true)}>
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <button
            ref={cell}
            type="button"
            aria-label={`Edit ${field.label}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded px-1 text-xs opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            Edit
          </button>
        </div>
      );
    }
    return (
      <button
        ref={cell}
        type="button"
        className={cn(className, "focus-visible:ring-ring block w-full text-left outline-none focus-visible:ring-2")}
        onClick={() => setEditing(true)}
      >
        {value}
        <span className="sr-only">, edit {field.label}</span>
      </button>
    );
  }
  return (
    <div
      ref={editor}
      className="min-w-40"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setEditing(false)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        refocus.current = true;
        setEditing(false);
      }}
    >
      <FieldControl
        def={field}
        value={draft ? draft.value : doc[field.key]}
        all={doc}
        onChange={(v) => {
          setDraft({ value: v });
          write({ [field.key]: v });
        }}
        onSet={(k, v) => write({ [k]: v })}
      />
    </div>
  );
}
