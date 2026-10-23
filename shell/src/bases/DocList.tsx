import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, Checkbox, cn, TagChips } from "@lifeline/ui";
import { displayTitle, docHref, excerpt, fieldByKey, useStableRows, type Document, type DocumentTypeDef, type FieldDef } from "@lifeline/core";
import { CellValue, EditableCell } from "./DocCell";

export type Layout = "table" | "cards" | "list";

/** Rows drawn at first, and added each time the end of the list comes into view. */
export const PAGE = 200;

type OnSelect = (id: string, on: boolean) => void;

/** The box that scrolls `el` up and down — not a sideways-only wrapper, which is as tall as what it holds. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * The first `PAGE × n` Documents, one more page each time the sentinel below
 * them scrolls into view — so a Base of thousands opens at the cost of a
 * page, and an edit redraws a page's worth of rows at most.
 */
function usePaged(docs: Document[]) {
  const [pages, setPages] = useState(1);
  const sentinel = useRef<HTMLDivElement>(null);
  const shown = Math.min(docs.length, pages * PAGE);
  const more = shown < docs.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!more || !el || typeof IntersectionObserver === "undefined") return;
    // Starts loading a screen ahead of the end, so scrolling never meets it.
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setPages((p) => p + 1), { root: scrollParent(el), rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);
  const tail = more ? (
    <div ref={sentinel} className="flex justify-center p-2">
      <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setPages((p) => p + 1)}>
        Show more ({docs.length - shown} left)
      </Button>
    </div>
  ) : null;
  return { rows: docs.slice(0, shown), tail };
}

/** Render the Documents of a Base/View in one of the three layouts. */
export function DocList({
  docs: input,
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
  onSelect?: OnSelect;
  compact?: boolean;
  onSort?: (key: string) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  // Row objects keep their identity until written, so the memoised rows below redraw only the edited one.
  const docs = useStableRows(input);
  const fields = useMemo(() => columns.map((k) => fieldByKey(def, k)).filter((f): f is FieldDef => !!f), [columns, def]);
  const { rows, tail } = usePaged(docs);
  if (docs.length === 0) return <div className="text-muted-foreground px-3 py-6 text-center text-sm">No Documents match.</div>;

  if (layout === "cards") {
    return (
      <>
        <div className={cn("grid gap-2 p-2", compact ? "grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]")}>
          {rows.map((d) => (
            <CardItem key={d.id} doc={d} def={def} fields={fields} isSelected={!!selected?.has(d.id)} onSelect={onSelect} />
          ))}
        </div>
        {tail}
      </>
    );
  }

  if (layout === "list") {
    return (
      <>
        <ul className="divide-y">
          {rows.map((d) => (
            <ListItem key={d.id} doc={d} def={def} fields={fields} compact={compact} isSelected={!!selected?.has(d.id)} onSelect={onSelect} />
          ))}
        </ul>
        {tail}
      </>
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
          {rows.map((d) => (
            <TableRow key={d.id} doc={d} def={def} fields={fields} editable={editable} isSelected={!!selected?.has(d.id)} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
      {tail}
    </div>
  );
}

// One component per row, memoised: an edit, or a tick in the selection, redraws that row alone.

const TableRow = memo(function TableRow({ doc, def, fields, editable, isSelected, onSelect }: { doc: Document; def: DocumentTypeDef | undefined; fields: FieldDef[]; editable: boolean; isSelected: boolean; onSelect?: OnSelect }) {
  return (
    <tr className={cn("border-t align-top hover:bg-accent/30", isSelected && "bg-accent/40")}>
      {onSelect && (
        <td className="px-2 py-1">
          <Checkbox checked={isSelected} aria-label={`Select ${displayTitle(doc, def)}`} onCheckedChange={(c) => onSelect(doc.id, c === true)} />
        </td>
      )}
      {fields.map((f) => (
        <td key={f.key} className="max-w-64 px-2 py-1">
          <EditableCell doc={doc} field={f} editable={editable} />
        </td>
      ))}
    </tr>
  );
});

const ListItem = memo(function ListItem({ doc, def, fields, compact, isSelected, onSelect }: { doc: Document; def: DocumentTypeDef | undefined; fields: FieldDef[]; compact?: boolean; isSelected: boolean; onSelect?: OnSelect }) {
  return (
    <li className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", isSelected && "bg-accent/40")}>
      {onSelect && <Checkbox checked={isSelected} aria-label={`Select ${displayTitle(doc, def)}`} onCheckedChange={(c) => onSelect(doc.id, c === true)} />}
      <Link to={docHref(doc, def)} className="min-w-0 flex-1 truncate font-medium hover:underline">
        {displayTitle(doc, def)}
      </Link>
      {fields
        .filter((f) => f.key !== "title" && f.key !== "tags")
        .slice(0, compact ? 1 : 3)
        .map((f) => (
          <span key={f.key} className="text-muted-foreground hidden max-w-40 truncate text-xs md:inline">
            <CellValue doc={doc} field={f} />
          </span>
        ))}
      {doc.tags.length > 0 && <TagChips tags={doc.tags} size="xs" />}
    </li>
  );
});

const CardItem = memo(function CardItem({ doc, def, fields, isSelected, onSelect }: { doc: Document; def: DocumentTypeDef | undefined; fields: FieldDef[]; isSelected: boolean; onSelect?: OnSelect }) {
  return (
    <div className={cn("bg-card rounded-lg border p-3 text-sm", isSelected && "ring-primary ring-2")}>
      <div className="flex items-start gap-2">
        {onSelect && <Checkbox checked={isSelected} aria-label={`Select ${displayTitle(doc, def)}`} onCheckedChange={(c) => onSelect(doc.id, c === true)} className="mt-0.5" />}
        <Link to={docHref(doc, def)} className="line-clamp-2 font-medium hover:underline">
          {displayTitle(doc, def)}
        </Link>
      </div>
      {typeof doc.body === "string" && doc.body && <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{excerpt(doc.body, 140)}</p>}
      <dl className="mt-2 grid gap-0.5 text-xs">
        {fields
          .filter((f) => f.key !== "title")
          .map((f) => (
            <div key={f.key} className="flex gap-2">
              <dt className="text-muted-foreground w-20 shrink-0 truncate">{f.label}</dt>
              <dd className="min-w-0 flex-1 truncate">
                <CellValue doc={doc} field={f} />
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
});
