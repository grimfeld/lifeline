import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useBacklinks } from "@lifeline/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from "@lifeline/ui";
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import type { Period } from "../domain/types";
import { colorVar } from "../domain/types";
import {
  average,
  booleanHeadline,
  collectedItems,
  currentStreak,
  formatValue,
  headline,
  longestStreak,
  markedDays,
} from "../domain/aggregate";
import { deleteEntry, deleteStat, useStat, useStatEntries } from "../data/repo";
import { AdditiveChart, CollectionChart, DotGrid, MeasurementChart } from "../components/charts";
import { AddEntryDialog } from "../components/AddEntryDialog";
import { StatEditorDialog } from "../components/StatEditorDialog";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7d" },
  { value: "month", label: "30d" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
];

export function StatDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stat = useStat(id);
  const entries = useStatEntries(id);
  const backlinks = useBacklinks({ appId: "stats", itemId: id ?? "" });
  const [period, setPeriod] = useState<Period>("month");
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.ts.localeCompare(a.ts)), [entries]);
  const days = useMemo(() => markedDays(entries), [entries]);
  const items = useMemo(() => collectedItems(entries), [entries]);

  if (!stat) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Stat not found.</div>;
  }
  const color = colorVar(stat.color);

  let big = "";
  let caption = "";
  if (stat.kind === "additive") {
    big = formatValue(headline("additive", entries, period) ?? 0);
    caption = "total in period";
  } else if (stat.kind === "measurement") {
    const h = headline("measurement", entries, period);
    const avg = average(entries, period);
    big = h === null ? "—" : formatValue(h);
    caption = avg === null ? "latest reading" : `latest · avg ${formatValue(avg)}`;
  } else if (stat.kind === "boolean") {
    const h = booleanHeadline(days, period);
    big = h.denominator ? `${h.count} / ${h.denominator}` : String(h.count);
    caption = "days marked";
  } else {
    big = stat.universeSize ? `${items.length} / ${stat.universeSize}` : String(items.length);
    caption = "items collected";
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="size-8" onClick={() => navigate("/app/stats")}>
          <ArrowLeft />
        </Button>
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <h1 className="truncate text-2xl font-semibold tracking-tight">{stat.name}</h1>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" title="Edit" onClick={() => setEditOpen(true)}>
            <Pencil />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" title="Delete stat" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
          </Button>
          <Button onClick={() => setLogOpen(true)}>{stat.kind === "boolean" ? "Mark" : "Log"}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tabular-nums">{big}</span>
          {stat.unit && <span className="text-muted-foreground">{stat.unit}</span>}
          <span className="text-muted-foreground ml-1 text-sm">{caption}</span>
        </div>
        {stat.kind === "boolean" && (
          <div className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{currentStreak(days)}</span> day streak · best {longestStreak(days)}
          </div>
        )}
        {stat.kind !== "collection" && (
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="ml-auto">
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <Card>
        <CardContent className="px-4">
          {stat.kind === "additive" && <AdditiveChart stat={stat} entries={entries} period={period} />}
          {stat.kind === "measurement" && <MeasurementChart stat={stat} entries={entries} period={period} />}
          {stat.kind === "boolean" && <DotGrid days={days} period={period} color={color} />}
          {stat.kind === "collection" && <CollectionChart stat={stat} items={items} />}
        </CardContent>
      </Card>

      {stat.kind === "collection" && items.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Collected</h2>
          <ul className="grid gap-1">
            {[...items].reverse().map((it) => (
              <li key={it.name} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{it.name}</Badge>
                <span className="text-muted-foreground text-xs">{new Date(it.firstTs).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">Entries</h2>
        {sorted.length === 0 && <p className="text-muted-foreground text-sm">Nothing logged yet.</p>}
        <ul className="grid gap-1">
          {sorted.slice(0, 200).map((e) => (
            <li key={e.id} className="bg-card flex items-center gap-3 rounded-md border px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {stat.kind === "boolean" ? <Check className="inline size-4" /> : stat.kind === "collection" ? e.item : `${formatValue(e.value)}${stat.unit ? ` ${stat.unit}` : ""}`}
              </span>
              <span className="text-muted-foreground text-xs">
                {stat.kind === "boolean" ? new Date(e.ts).toLocaleDateString() : new Date(e.ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <Button size="icon" variant="ghost" className="size-7" title="Delete entry" onClick={() => void deleteEntry(e.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {backlinks.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Mentioned in</h2>
          <ul className="grid gap-1">
            {backlinks.map((b) => (
              <li key={`${b.appId}/${b.sourceId}`}>
                <button
                  type="button"
                  className="text-sm hover:underline disabled:no-underline"
                  disabled={!b.href}
                  onClick={() => b.href && navigate(b.href)}
                >
                  {b.title}
                </button>
                {b.excerpt && <span className="text-muted-foreground ml-2 text-xs">{b.excerpt}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddEntryDialog open={logOpen} onOpenChange={setLogOpen} stat={stat} entries={entries} />
      <StatEditorDialog open={editOpen} onOpenChange={setEditOpen} stat={stat} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{stat.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Every logged entry for this stat is deleted with it. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void deleteStat(stat.id).then(() => {
                  toast.success("Stat deleted");
                  navigate("/app/stats");
                });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
