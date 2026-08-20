import { Link } from "react-router";
import { Checkbox, cn, TagChips } from "@lifeline/ui";
import { displayTitle, docHref, excerpt, fieldByKey, type Document, type DocumentTypeDef, type FieldDef } from "@lifeline/core";
import { CellValue, EditableCell } from "./DocCell";

export type Layout = "table" | "cards" | "list";

/** Render the Documents of a Base/View in one of the three layouts. */
export function DocList({
  docs,
  def,
  columns,
  layout,
  editable = true,
  selected,
  onSelect,
  compact,
  onSort,
  sortBy,
  sortDir,
}: {
  docs: Document[];
  def: DocumentTypeDef | undefined;
  columns: string[];
  layout: Layout;
  editable?: boolean;
  selected?: Set<string>;
  onSelect?: (id: string, on: boolean) => void;
  compact?: boolean;
  onSort?: (key: string) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const fields = columns.map((k) => fieldByKey(def, k)).filter((f): f is FieldDef => !!f);
  if (docs.length === 0) return <div className="text-muted-foreground px-3 py-6 text-center text-sm">No Documents match.</div>;

  if (layout === "cards") {
    return (
      <div className={cn("grid gap-2 p-2", compact ? "grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]")}>
        {docs.map((d) => (
          <div key={d.id} className={cn("bg-card rounded-lg border p-3 text-sm", selected?.has(d.id) && "ring-primary ring-2")}>
            <div className="flex items-start gap-2">
              {onSelect && <Checkbox checked={selected?.has(d.id)} onCheckedChange={(c) => onSelect(d.id, c === true)} className="mt-0.5" />}
              <Link to={docHref(d, def)} className="line-clamp-2 font-medium hover:underline">
                {displayTitle(d, def)}
              </Link>
            </div>
            {typeof d.body === "string" && d.body && <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{excerpt(d.body, 140)}</p>}
            <dl className="mt-2 grid gap-0.5 text-xs">
              {fields
                .filter((f) => f.key !== "title")
                .map((f) => (
                  <div key={f.key} className="flex gap-2">
                    <dt className="text-muted-foreground w-20 shrink-0 truncate">{f.label}</dt>
                    <dd className="min-w-0 flex-1 truncate">
                      <CellValue doc={d} field={f} />
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "list") {
    return (
      <ul className="divide-y">
        {docs.map((d) => (
          <li key={d.id} className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", selected?.has(d.id) && "bg-accent/40")}>
            {onSelect && <Checkbox checked={selected?.has(d.id)} onCheckedChange={(c) => onSelect(d.id, c === true)} />}
            <Link to={docHref(d, def)} className="min-w-0 flex-1 truncate font-medium hover:underline">
              {displayTitle(d, def)}
            </Link>
            {fields
              .filter((f) => f.key !== "title" && f.key !== "tags")
              .slice(0, compact ? 1 : 3)
              .map((f) => (
                <span key={f.key} className="text-muted-foreground hidden max-w-40 truncate text-xs sm:inline">
                  <CellValue doc={d} field={f} />
                </span>
              ))}
            {d.tags.length > 0 && <TagChips tags={d.tags} size="xs" />}
          </li>
        ))}
      </ul>
    );
  }

  const arrow = (k: string) => (sortBy === k ? (sortDir === "desc" ? " ↓" : " ↑") : "");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground sticky top-0 z-10 text-left text-xs">
          <tr>
            {onSelect && <th className="w-8 px-2 py-1.5" />}
            {fields.map((f) => (
              <th key={f.key} className={cn("px-2 py-1.5 font-medium whitespace-nowrap", onSort && "cursor-pointer select-none hover:text-foreground")} onClick={() => onSort?.(f.key)}>
                {f.label}
                {arrow(f.key)}
                {f.guarded && <span className="ml-1 opacity-60" title="Guarded">🔒</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className={cn("border-t align-top hover:bg-accent/30", selected?.has(d.id) && "bg-accent/40")}>
              {onSelect && (
                <td className="px-2 py-1">
                  <Checkbox checked={selected?.has(d.id)} onCheckedChange={(c) => onSelect(d.id, c === true)} />
                </td>
              )}
              {fields.map((f) => (
                <td key={f.key} className="max-w-64 px-2 py-1">
                  <EditableCell doc={d} field={f} editable={editable} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
