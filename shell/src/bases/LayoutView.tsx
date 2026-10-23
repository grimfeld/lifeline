import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, cn, MapView, TagChips, toast, type MapPin } from "@lifeline/ui";
import {
  addDays,
  appById,
  displayTitle,
  docHref,
  fromParts,
  layoutFieldOf,
  parts,
  requestFieldChange,
  startOfWeek,
  todayStr,
  type Document,
  type DocumentTypeDef,
  type LayoutFields,
  type ViewLayout,
} from "@lifeline/core";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { DocList, type Layout as FlatLayout } from "./DocList";

/**
 * Render a View's Documents in its layout (ADR 0020). The three flat
 * layouts go through DocList; gallery/map/board/calendar live here. Layouts
 * display — a board drag routes through requestFieldChange (raw write for
 * plain fields, owning-App request for guarded ones), everything else is
 * read-only. Documents a layout cannot place are omitted but counted.
 */
export function LayoutView({
  docs,
  def,
  columns,
  layout,
  picks,
  selected,
  onSelect,
  compact,
  editable = true,
  onSort,
  sortBy,
  sortDir,
}: {
  docs: Document[];
  def: DocumentTypeDef | undefined;
  columns: string[];
  layout: ViewLayout;
  picks: LayoutFields;
  selected?: Set<string>;
  onSelect?: (id: string, on: boolean) => void;
  compact?: boolean;
  editable?: boolean;
  onSort?: (key: string) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  if (layout === "gallery") return <Gallery docs={docs} def={def} picks={picks} compact={compact} selected={selected} onSelect={onSelect} />;
  if (layout === "map") return <MapLayout docs={docs} def={def} picks={picks} />;
  if (layout === "board") return <Board docs={docs} def={def} picks={picks} compact={compact} editable={editable} />;
  if (layout === "calendar") return <CalendarGrid docs={docs} def={def} picks={picks} compact={compact} />;
  return (
    <DocList docs={docs} def={def} columns={columns} layout={layout as FlatLayout} editable={editable} selected={selected} onSelect={onSelect} compact={compact} onSort={onSort} sortBy={sortBy} sortDir={sortDir} />
  );
}

/** "N shown · M without <what>" — a layout never silently swallows Documents (ADR 0020). */
function OmittedNote({ shown, omitted, what, def }: { shown: number; omitted: Document[]; what: string; def: DocumentTypeDef | undefined }) {
  const [open, setOpen] = useState(false);
  if (omitted.length === 0) return null;
  return (
    <div className="text-muted-foreground border-t px-3 py-1 text-xs">
      <button type="button" className="hover:text-foreground underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)}>
        {shown} shown · {omitted.length} without {what}
      </button>
      {open && (
        <span className="ml-2 inline-flex flex-wrap gap-x-2">
          {omitted.map((d) => (
            <Link key={d.id} to={docHref(d, def)} className="hover:text-foreground underline">
              {displayTitle(d, def)}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
}

// --- gallery ---------------------------------------------------------------

function Gallery({ docs, def, picks, compact, selected, onSelect }: { docs: Document[]; def: DocumentTypeDef | undefined; picks: LayoutFields; compact?: boolean; selected?: Set<string>; onSelect?: (id: string, on: boolean) => void }) {
  const field = layoutFieldOf(picks, def, "gallery");
  if (docs.length === 0) return <div className="text-muted-foreground px-3 py-6 text-center text-sm">No Documents match.</div>;
  return (
    <div className={cn("grid gap-3 p-3", compact ? "grid-cols-3" : "grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]")}>
      {docs.map((d) => {
        const url = field ? String(d[field.key] ?? "") : "";
        return (
          <Link
            key={d.id}
            to={docHref(d, def)}
            className={cn("group flex flex-col gap-1", selected?.has(d.id) && "ring-primary rounded-lg ring-2")}
            onClick={(e) => {
              if (onSelect && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSelect(d.id, !selected?.has(d.id));
              }
            }}
          >
            <div className="bg-muted flex aspect-2/3 items-center justify-center overflow-hidden rounded-lg border">
              {url ? (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <ImageOff className="text-muted-foreground size-6" />
              )}
            </div>
            <span className="line-clamp-2 text-xs font-medium group-hover:underline">{displayTitle(d, def)}</span>
          </Link>
        );
      })}
    </div>
  );
}

// --- map -------------------------------------------------------------------

function MapLayout({ docs, def, picks }: { docs: Document[]; def: DocumentTypeDef | undefined; picks: LayoutFields }) {
  const field = layoutFieldOf(picks, def, "map");
  const { pins, omitted } = useMemo(() => {
    const pins: MapPin[] = [];
    const omitted: Document[] = [];
    for (const d of docs) {
      const v = field ? d[field.key] : undefined;
      const [lat, lon] = Array.isArray(v) ? (v as [number, number]) : [NaN, NaN];
      if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
        pins.push({ key: d.id, name: displayTitle(d, def), lat, lon, href: docHref(d, def), color: appById(def?.appId ?? "")?.color });
      } else omitted.push(d);
    }
    return { pins, omitted };
  }, [docs, def, field]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <MapView pins={pins} />
      </div>
      <OmittedNote shown={pins.length} omitted={omitted} what="location" def={def} />
    </div>
  );
}

// --- board -----------------------------------------------------------------

function Board({ docs, def, picks, compact, editable }: { docs: Document[]; def: DocumentTypeDef | undefined; picks: LayoutFields; compact?: boolean; editable?: boolean }) {
  const field = layoutFieldOf(picks, def, "board");
  const [dragging, setDragging] = useState<string | null>(null);
  // ADR 0020: a plain select drags freely; a guarded one only when the owning App answers requests.
  const draggable = !!editable && !!field && (!field.guarded || !!(def?.appId && appById(def.appId)?.requestFieldChange));
  if (!field) return <div className="text-muted-foreground px-3 py-6 text-center text-sm">Board needs a select field.</div>;
  const options = field.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const byValue = new Map<string, Document[]>();
  for (const d of docs) {
    const v = String(d[field.key] ?? "");
    const key = known.has(v) ? v : "";
    byValue.set(key, [...(byValue.get(key) ?? []), d]);
  }
  const columns = [...options.map((o) => ({ value: o.value, label: o.label })), ...(byValue.has("") ? [{ value: "", label: "—" }] : [])];

  async function drop(value: string) {
    if (!dragging || !field) return;
    const doc = docs.find((d) => d.id === dragging);
    setDragging(null);
    if (!doc || String(doc[field.key] ?? "") === value || value === "") return;
    const result = await requestFieldChange(doc, def, field.key, value);
    if (result === "declined") toast.error(`${appById(def?.appId ?? "")?.title ?? "The App"} declined ${field.label} → ${columns.find((c) => c.value === value)?.label ?? value}`);
    if (result === "readonly") toast.error(`${field.label} changes only through its App`);
  }

  return (
    <div className="flex h-full min-h-0 gap-2 overflow-x-auto p-2">
      {columns.map((c) => {
        const items = byValue.get(c.value) ?? [];
        return (
          <div
            key={c.value || "—"}
            className={cn("bg-muted/40 flex min-h-0 flex-col rounded-lg border", compact ? "w-40 shrink-0" : "w-56 shrink-0")}
            onDragOver={(e) => {
              if (draggable && c.value !== "") e.preventDefault();
            }}
            onDrop={() => void drop(c.value)}
          >
            <div className="text-muted-foreground flex items-center justify-between px-2 py-1.5 text-xs font-medium">
              {c.label}
              <span className="tabular-nums">{items.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5 pt-0">
              {items.map((d) => (
                <div
                  key={d.id}
                  draggable={draggable}
                  onDragStart={() => setDragging(d.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cn("bg-card rounded-lg border p-2 text-xs", draggable && "cursor-grab active:cursor-grabbing", dragging === d.id && "opacity-50")}
                >
                  <Link to={docHref(d, def)} className="line-clamp-2 font-medium hover:underline" draggable={false}>
                    {displayTitle(d, def)}
                  </Link>
                  {d.tags.length > 0 && !compact && <TagChips tags={d.tags} size="xs" />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- calendar --------------------------------------------------------------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Read-only month grid over one date/datetime field (ADR 0020): for seeing, never for moving. */
function CalendarGrid({ docs, def, picks, compact }: { docs: Document[]; def: DocumentTypeDef | undefined; picks: LayoutFields; compact?: boolean }) {
  const field = layoutFieldOf(picks, def, "calendar");
  const today = todayStr();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "YYYY-MM"
  const { byDay, omitted, placed } = useMemo(() => {
    const byDay = new Map<string, Document[]>();
    const omitted: Document[] = [];
    let placed = 0;
    for (const d of docs) {
      const day = String((field ? d[field.key] : "") ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        byDay.set(day, [...(byDay.get(day) ?? []), d]);
        placed++;
      } else omitted.push(d);
    }
    return { byDay, omitted, placed };
  }, [docs, field]);

  const [y = 0, m = 1] = month.split("-").map(Number);
  const gridStart = startOfWeek(fromParts(y, m, 1));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    // Drop the 6th row when it lies wholly in the next month.
    .filter((_, i) => i < 35 || parts(addDays(gridStart, 35)).m === m);
  const shift = (n: number) => setMonth(fromParts(y, m + n, 1).slice(0, 7));
  const monthName = new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const max = compact ? 2 : 4;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 py-1.5">
        <span className="text-sm font-medium">{monthName}</span>
        <span className="ml-auto" />
        <Button size="icon-xs" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button size="xs" variant="ghost" className="px-2" onClick={() => setMonth(today.slice(0, 7))}>
          Today
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      <div className="text-muted-foreground grid grid-cols-7 border-b px-px text-center text-2xs">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const inMonth = parts(day).m === m;
          const items = byDay.get(day) ?? [];
          return (
            <div key={day} className={cn("min-h-16 border-r border-b p-1", !inMonth && "bg-muted/30")}>
              <div className={cn("text-right text-2xs", day === today ? "text-primary font-semibold" : "text-muted-foreground")}>{parts(day).day}</div>
              {items.slice(0, max).map((d) => (
                <Link key={d.id} to={docHref(d, def)} className="bg-accent/60 hover:bg-accent mb-0.5 block truncate rounded px-1 text-2xs leading-4">
                  {displayTitle(d, def)}
                </Link>
              ))}
              {items.length > max && <div className="text-muted-foreground px-1 text-2xs">+{items.length - max} more</div>}
            </div>
          );
        })}
      </div>
      <OmittedNote shown={placed} omitted={omitted} what={field ? field.label.toLowerCase() : "date"} def={def} />
    </div>
  );
}
