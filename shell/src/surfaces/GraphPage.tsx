import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  buildGraph,
  docHref,
  putDocument,
  useDocumentTypes,
  useLinkIndex,
  type GraphNode,
} from "@lifeline/core";
import { cn, GraphView, Input, toast } from "@lifeline/ui";
import { Waypoints } from "lucide-react";
import { TagFilterBar } from "../components/TagFilterBar";

/**
 * The Graph Surface (ADR 0023): every Linkable Document as a node, every link
 * relation as an edge, coloured by owning App. Controls persist locally;
 * layout is derived and never synced.
 */

interface GraphPrefs {
  ghosts: boolean;
  tags: boolean;
  orphans: boolean;
  hidden: string[];
  tagFilter: string[];
}

const PREFS_KEY = "lifeline.graph.prefs";
const DEFAULTS: GraphPrefs = { ghosts: true, tags: false, orphans: false, hidden: [], tagFilter: [] };

function loadPrefs(): GraphPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<GraphPrefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
        on ? "bg-accent" : "text-muted-foreground opacity-60",
      )}
    >
      {children}
    </button>
  );
}

export function GraphPage() {
  const navigate = useNavigate();
  const index = useLinkIndex();
  const types = useDocumentTypes();
  const [prefs, setPrefsState] = useState<GraphPrefs>(loadPrefs);
  const [q, setQ] = useState("");

  const setPrefs = (patch: Partial<GraphPrefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const linkableTypes = useMemo(() => types.filter((t) => !t.internal && t.linkable), [types]);
  const hiddenSet = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
  const model = useMemo(
    () =>
      buildGraph(index, types, {
        ghosts: prefs.ghosts,
        tags: prefs.tags,
        orphans: prefs.orphans,
        hiddenTypes: hiddenSet,
        tagFilter: prefs.tagFilter,
      }),
    [index, types, prefs.ghosts, prefs.tags, prefs.orphans, hiddenSet, prefs.tagFilter],
  );
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of model.nodes) if (n.type) m.set(n.type, (m.get(n.type) ?? 0) + 1);
    return m;
  }, [model]);
  const highlight = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return undefined;
    return new Set(model.nodes.filter((n) => n.label.toLowerCase().includes(needle)).map((n) => n.id));
  }, [q, model]);

  const toggleType = (id: string) =>
    setPrefs({ hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((t) => t !== id) : [...prefs.hidden, id] });

  const open = (node: GraphNode) => {
    if (node.kind === "doc" && node.docId) {
      const d = index.byId.get(node.docId);
      if (d) navigate(docHref(d));
      return;
    }
    if (node.kind === "ghost") {
      // A Ghost node is a hole in the vault: clicking it creates the Note.
      void putDocument({ type: "note", title: node.label, body: "" }).then((n) => {
        toast.success(`Created “${node.label}”`);
        navigate(docHref(n));
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Waypoints className="text-muted-foreground size-4" />
        <h1 className="text-lg font-semibold tracking-tight">Graph</h1>
        <span className="text-muted-foreground text-xs tabular-nums">
          {model.nodes.length} nodes · {model.edges.length} links
        </span>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" className="h-7 w-40 text-xs" />
        <TagFilterBar value={prefs.tagFilter} onChange={(tagFilter) => setPrefs({ tagFilter })} />
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Chip on={prefs.ghosts} onClick={() => setPrefs({ ghosts: !prefs.ghosts })}>
            Unresolved
          </Chip>
          <Chip on={prefs.tags} onClick={() => setPrefs({ tags: !prefs.tags })}>
            Tags
          </Chip>
          <Chip on={prefs.orphans} onClick={() => setPrefs({ orphans: !prefs.orphans })}>
            Orphans
          </Chip>
          <span className="bg-border mx-1 h-4 w-px" />
          {linkableTypes.map((t) => {
            const on = !hiddenSet.has(t.id);
            const color = model.nodes.find((n) => n.type === t.id)?.color;
            return (
              <Chip key={t.id} on={on} onClick={() => toggleType(t.id)}>
                <span className="size-2 rounded-full" style={{ background: color ?? "var(--chart-green)" }} />
                {t.label}
                {on && <span className="text-muted-foreground tabular-nums">{counts.get(t.id) ?? 0}</span>}
              </Chip>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <GraphView nodes={model.nodes} edges={model.edges} onSelect={open} storageKey="surface" highlight={highlight} />
      </div>
    </div>
  );
}
